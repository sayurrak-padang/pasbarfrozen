from pymongo.errors import DuplicateKeyError
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, jwt, bcrypt, requests, hashlib, hmac, json
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Literal, Optional
from datetime import datetime, timezone, timedelta

from seed_data import CATEGORIES, build_products
from brand import BRAND, STORE_NAME, CITY

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
JWT_SECRET = os.environ['JWT_SECRET']
BITESHIP_API_KEY = os.environ.get('BITESHIP_API_KEY', '')
BITESHIP_ORIGIN_POSTAL = os.environ.get('BITESHIP_ORIGIN_POSTAL', CITY['originPostal'])
MIDTRANS_SERVER_KEY = os.environ['MIDTRANS_SERVER_KEY']
MIDTRANS_CLIENT_KEY = os.environ['MIDTRANS_CLIENT_KEY']
MIDTRANS_PRODUCTION = os.environ.get('MIDTRANS_IS_PRODUCTION') == 'true'
SNAP_BASE = "https://app.midtrans.com" if MIDTRANS_PRODUCTION else "https://app.sandbox.midtrans.com"
CORE_BASE = "https://api.midtrans.com" if MIDTRANS_PRODUCTION else "https://api.sandbox.midtrans.com"
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = BRAND["slug"]
WIB = timezone(timedelta(hours=7))
DELIVERY_SLOTS = ["09:00-11:00", "11:00-13:00", "13:00-15:00", "15:00-17:00", "17:00-18:00"]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------- Models ----------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    otp_code: Optional[str] = None
    email_code: str = Field(default="", max_length=6)

class OtpSend(BaseModel):
    phone: str
    purpose: str = "signup"

class OtpLogin(BaseModel):
    phone: str
    code: str

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class CartItem(BaseModel):
    product_id: str
    name: str
    image: str
    price: int
    quantity: int = Field(ge=1)
    unit: str
    variant_id: Optional[str] = None
    variant_name: Optional[str] = None
    recipe_id: Optional[str] = None

class Variant(BaseModel):
    variant_id: Optional[str] = None
    name: str = Field(min_length=1)
    price: int = Field(ge=0)
    hpp: int = Field(default=0, ge=0)
    store_price: int = Field(default=0, ge=0)  # harga toko (kasir); 0 = ikut harga web
    stock: int = Field(default=0, ge=0)
    weight: int = Field(default=0, ge=0, le=50000)

class OrderInput(BaseModel):
    items: List[CartItem]
    subtotal: int
    shipping_cost: int
    discount: int = 0
    total: int
    courier: str
    courier_type: str
    payment_method: str
    address: dict
    voucher_code: Optional[str] = ""
    note: Optional[str] = ""
    delivery_date: Optional[str] = ""
    delivery_slot: Optional[str] = ""
    courier_service_code: Optional[str] = ""
    ref_code: Optional[str] = ""

class AddressInput(BaseModel):
    label: str = "Rumah"
    name: str
    phone: str
    full: str
    postal: str = ""
    district: str = ""
    city: str = ""
    province: str = ""
    area_id: str = ""
    detail: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_default: bool = False

class BannerInput(BaseModel):
    title: str = ""
    subtitle: str = ""
    cta_label: str = "Belanja Sekarang"
    link: str = ""
    image_url: str
    theme: str = "dark"
    active: bool = True
    order: int = 0

class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    image: Optional[str] = None
    description: Optional[str] = None
    hpp: Optional[int] = Field(default=None, ge=0)
    store_price: Optional[int] = Field(default=None, ge=0)
    price: Optional[int] = None
    stock: Optional[int] = None
    discount: Optional[int] = None
    active: Optional[bool] = None
    archived: Optional[bool] = None
    unit: Optional[str] = None
    variants: Optional[List[Variant]] = None
    weight: Optional[int] = Field(default=None, ge=1, le=50000)

class OrderStatusUpdate(BaseModel):
    status: str


# ---------------- Helpers ----------------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def make_jwt(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def clean(doc):
    if doc and "_id" in doc:
        doc.pop("_id")
    return doc

async def get_current_user(request: Request):
    token = None
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1]
    if not token:
        token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # Try JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
        if user:
            return user
    except jwt.PyJWTError:
        pass
    # Try Emergent session token
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        exp = sess["expires_at"]
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp > datetime.now(timezone.utc):
            user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
            if user:
                return user
    raise HTTPException(status_code=401, detail="Invalid or expired session")

async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if user.get("must_change_password"):
        raise HTTPException(status_code=403, detail="PASSWORD_CHANGE_REQUIRED")
    return user

def public_user(u: dict) -> dict:
    return {"user_id": u["user_id"], "name": u["name"], "email": u["email"], "role": u.get("role", "customer"),
            "picture": u.get("picture", ""), "has_password": bool(u.get("password")),
            "phone": u.get("phone") or "", "phone_verified": bool(u.get("phone_verified")),
            "must_change_password": bool(u.get("must_change_password")),
            "refund_method": (u.get("refund_method") or {}).get("method", "saldo")}


# ---------------- Twilio (WhatsApp OTP & notifications) ----------------
import asyncio
import re as _re
from twilio.rest import Client as TwilioClient
from twilio.base.exceptions import TwilioRestException

twilio = TwilioClient(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
VERIFY_SID = os.environ["TWILIO_VERIFY_SERVICE"]
OTP_CHANNEL = os.environ.get("TWILIO_OTP_CHANNEL", "whatsapp")
OTP_SIGNUP_REQUIRED = os.environ.get("OTP_SIGNUP_REQUIRED") == "true"
WA_FROM = os.environ["TWILIO_WHATSAPP_FROM"]
WA_TEMPLATE = os.environ.get("TWILIO_WA_TEMPLATE_SID", "")

def normalize_phone(raw: str) -> str:
    p = _re.sub(r"[^\d+]", "", raw or "")
    if p.startswith("+"):
        p = p[1:]
    elif p.startswith("0"):
        p = "62" + p[1:]
    if not _re.fullmatch(r"\d{9,15}", p):
        raise HTTPException(status_code=400, detail="Nomor WhatsApp tidak valid")
    return "+" + p

def twilio_err(e: TwilioRestException) -> str:
    logger.error(f"Twilio error {e.code}: {e.msg}")
    if e.code in (60410, 21608) or "verified tester" in (e.msg or ""):
        return "Nomor belum terdaftar sebagai penguji (akun Twilio masih trial)"
    if e.code == 60203:
        return "Terlalu banyak permintaan kode. Coba lagi nanti"
    return "Gagal mengirim kode via WhatsApp"

async def verify_otp(phone: str, code: str) -> bool:
    try:
        r = await asyncio.to_thread(lambda: twilio.verify.v2.services(VERIFY_SID).verification_checks.create(to=phone, code=code))
        return r.status == "approved"
    except TwilioRestException as e:
        if e.status == 404:
            return False
        raise HTTPException(status_code=400, detail=twilio_err(e))

ORDER_EVENTS = {
    "created": "Pesanan *{oid}* sudah kami terima. Total {total}. " + BRAND["messages"]["thanks"].replace("{", "{{").replace("}", "}}"),
    "paid": "Pembayaran pesanan *{oid}* berhasil. Pesanan segera kami siapkan.",
    "driver": "Driver {driver} sedang menjemput pesanan *{oid}*.{track}",
    "shipped": "Pesanan *{oid}* sedang dalam perjalanan ke alamat Anda.{track}",
    "delivered": "Pesanan *{oid}* sudah sampai. " + BRAND["messages"]["delivered"].replace("{", "{{").replace("}", "}}"),
}

def _send_wa(to: str, name: str, oid: str, text: str):
    kw = {"from_": f"whatsapp:{WA_FROM}", "to": f"whatsapp:{to}"}
    if WA_TEMPLATE:
        kw["content_sid"] = WA_TEMPLATE
        kw["content_variables"] = json.dumps({"1": name, "2": oid, "3": text.replace("*", "")})
    else:
        kw["body"] = f"Halo {name}, {text}"
    return twilio.messages.create(**kw).sid

async def notify_order(order_id: str, event: str):
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o or event in (o.get("notified") or []):
        return
    await db.orders.update_one({"order_id": order_id}, {"$addToSet": {"notified": event}})
    s = o.get("shipment") or {}
    text = ORDER_EVENTS[event].format(oid=order_id, total=f"Rp{o['total']:,}".replace(",", "."),
                                      driver=s.get("driver_name") or "kami",
                                      track=f" Lacak: {s['tracking_link']}" if s.get("tracking_link") else "")
    entry = {"event": event, "at": datetime.now(timezone.utc).isoformat()}
    try:
        to = normalize_phone((o.get("address") or {}).get("phone", ""))
        entry["sid"] = await asyncio.to_thread(_send_wa, to, (o.get("address") or {}).get("name") or o["user_name"], order_id, text)
        entry["status"] = "sent"
    except (TwilioRestException, HTTPException) as e:
        entry["status"] = "failed"
        entry["error"] = getattr(e, "msg", None) or getattr(e, "detail", "")
        logger.error(f"WA notify {order_id}/{event} failed: {entry['error']}")
    await db.orders.update_one({"order_id": order_id}, {"$push": {"notifications": entry}})

_bg_tasks = set()

def run_bg(coro):
    t = asyncio.create_task(coro)
    _bg_tasks.add(t)
    t.add_done_callback(_bg_tasks.discard)

def notify_bg(order_id: str, event: str):
    run_bg(notify_order(order_id, event))

async def notify_owners(order_id: str):
    r = await db.orders.update_one({"order_id": order_id, "owner_alerted": {"$ne": True}}, {"$set": {"owner_alerted": True}})
    store = await db.settings.find_one({"key": "store"}, {"_id": 0}) or {}
    if not r.modified_count or not store.get("owner_phones"):
        return
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    a = o.get("address") or {}
    text = (f"Pesanan LUNAS *{order_id}* · Rp{o['total']:,} · {sum(i['quantity'] for i in o['items'])} item · "
            f"{o.get('courier', '')} · {a.get('name', '')} ({a.get('phone', '')}). Segera siapkan pesanan.").replace(",", ".")
    for phone in store["owner_phones"]:
        entry = {"event": "owner_paid", "to": phone, "at": now_iso()}
        try:
            entry["sid"] = await asyncio.to_thread(_send_wa, phone, "Owner", order_id, text)
            entry["status"] = "sent"
        except TwilioRestException as e:
            entry.update(status="failed", error=e.msg)
            logger.error(f"Owner alert {order_id} -> {phone} failed: {e.msg}")
        await db.orders.update_one({"order_id": order_id}, {"$push": {"notifications": entry}})

def notify_owners_bg(order_id: str):
    run_bg(notify_owners(order_id))

@api_router.post("/auth/otp/send")
async def otp_send(data: OtpSend):
    phone = normalize_phone(data.phone)
    if data.purpose == "login" and not await db.users.find_one({"phone": phone, "phone_verified": True}):
        raise HTTPException(status_code=404, detail="Nomor belum terhubung ke akun manapun")
    if data.purpose == "signup" and await db.users.find_one({"phone": phone, "phone_verified": True}):
        raise HTTPException(status_code=400, detail="Nomor sudah dipakai akun lain")
    since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    recent = await db.otp_requests.find({"phone": phone, "at": {"$gt": since}}, {"_id": 0}).sort("at", -1).to_list(10)
    if recent and recent[0]["at"] > (datetime.now(timezone.utc) - timedelta(seconds=60)).isoformat():
        raise HTTPException(status_code=429, detail="Tunggu 60 detik sebelum meminta kode lagi")
    if len(recent) >= 5:
        raise HTTPException(status_code=429, detail="Terlalu banyak permintaan kode. Coba lagi 1 jam lagi")
    try:
        await asyncio.to_thread(lambda: twilio.verify.v2.services(VERIFY_SID).verifications.create(to=phone, channel=OTP_CHANNEL))
    except TwilioRestException as e:
        raise HTTPException(status_code=400, detail=twilio_err(e))
    await db.otp_requests.insert_one({"phone": phone, "purpose": data.purpose, "at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True, "phone": phone, "channel": OTP_CHANNEL}

@api_router.post("/auth/otp/login")
async def otp_login(data: OtpLogin):
    phone = normalize_phone(data.phone)
    user = await db.users.find_one({"phone": phone, "phone_verified": True}, {"_id": 0})
    if not user or not await verify_otp(phone, data.code.strip()):
        raise HTTPException(status_code=401, detail="Kode OTP salah atau kedaluwarsa")
    return {"token": make_jwt(user["user_id"]), "user": {"user_id": user["user_id"], "name": user["name"], "email": user["email"],
            "role": user.get("role", "customer"), "picture": user.get("picture", ""), "has_password": bool(user.get("password"))}}

@api_router.get("/auth/otp/config")
async def otp_config():
    return {"signup_required": OTP_SIGNUP_REQUIRED, "channel": OTP_CHANNEL}


# ---------------- Auth routes ----------------
@api_router.post("/auth/register")
async def register(data: RegisterInput):
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password minimal 8 karakter")
    phone, verified = (normalize_phone(data.phone) if data.phone else None), False
    if phone and await db.users.find_one({"phone": phone}):
        raise HTTPException(status_code=400, detail="Nomor sudah dipakai akun lain")
    if not await consume_email_otp(data.email.lower(), data.email_code, "signup"):
        raise HTTPException(status_code=400, detail="Kode verifikasi email salah atau kedaluwarsa")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = {
        "user_id": user_id, "name": data.name, "email": data.email.lower(),
        "password": hash_pw(data.password), "role": "customer", "picture": "",
        "phone": phone, "phone_verified": verified, "email_verified": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.users.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    token = make_jwt(user_id)
    return {"token": token, "user": {"user_id": user_id, "name": data.name, "email": data.email.lower(), "role": "customer", "picture": "", "has_password": True}}

@api_router.post("/auth/login")
async def login(data: LoginInput, request: Request):
    ident = data.email.lower()
    now = datetime.now(timezone.utc)
    att = await db.login_attempts.find_one({"identifier": ident}, {"_id": 0})
    if att and att.get("count", 0) >= 5 and datetime.fromisoformat(att["last"]) > now - timedelta(minutes=15):
        raise HTTPException(status_code=429, detail="Terlalu banyak percobaan login. Coba lagi dalam 15 menit")
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not user.get("password") or not verify_pw(data.password, user["password"]):
        count = 1 if not att or datetime.fromisoformat(att["last"]) <= now - timedelta(minutes=15) else att["count"] + 1
        await db.login_attempts.update_one({"identifier": ident}, {"$set": {"count": count, "last": now.isoformat()}}, upsert=True)
        raise HTTPException(status_code=401, detail="Email atau password salah")
    await db.login_attempts.delete_one({"identifier": ident})
    return {"token": make_jwt(user["user_id"]), "user": public_user(user)}

@api_router.post("/auth/session")
async def emergent_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    r = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": session_id}, timeout=15,
    )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    d = r.json()
    email = d["email"].lower()
    await db.users.update_one({"email": email}, {"$setOnInsert": {
        "user_id": f"user_{uuid.uuid4().hex[:12]}", "name": d["name"], "email": email, "role": "customer",
        "picture": d.get("picture", ""), "email_verified": True, "created_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    user = await db.users.find_one({"email": email}, {"_id": 0}, sort=[("created_at", 1)])
    session_token = d["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user["user_id"], "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie("session_token", session_token, httponly=True, secure=True,
                        samesite="none", path="/", max_age=7 * 24 * 3600)
    return {"user": {"user_id": user["user_id"], "name": user["name"], "email": user["email"], "role": user.get("role", "customer"), "picture": user.get("picture", "")}, "session_token": session_token}

@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return public_user(user)

@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordInput, user=Depends(get_current_user)):
    if not user.get("password"):
        raise HTTPException(status_code=400, detail="Akun Google tidak memakai password")
    if not verify_pw(data.current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Password lama salah")
    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="Password baru harus berbeda")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {
        "password": hash_pw(data.new_password), "must_change_password": False, "password_changed_at": now_iso()}})
    return {"ok": True}

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------------- Catalog routes ----------------
@api_router.get("/categories")
async def get_categories():
    cats = await db.categories.find({}, {"_id": 0}).to_list(100)
    return cats if cats else CATEGORIES

EASY_FOOD_RE = r"easy\s*foods?|tinggal\s*goreng|marinasi|siap\s*masak"

# Harga toko hanya untuk kasir/admin, tidak ditampilkan ke pembeli web.
PUBLIC_PRODUCT_PROJ = {"_id": 0, "store_price": 0, "variants.store_price": 0}

@api_router.get("/products")
async def get_products(category: Optional[str] = None, search: Optional[str] = None,
                       best_seller: Optional[bool] = None, discount: Optional[bool] = None):
    q = {"active": True} if search else {"active": True, "stock": {"$gt": 0}}
    if category == "new-arrival":
        q["new_arrival"] = True
    elif category == "easy-food":
        q["name"] = {"$regex": EASY_FOOD_RE, "$options": "i"}
    elif category:
        q["category"] = category
    if best_seller:
        q["best_seller"] = True
    if discount:
        q["discount"] = {"$gt": 0}
    if search:
        name_q = {"name": {"$regex": _re.escape(search[:80]), "$options": "i"}}
        q = {"$and": [q, name_q]} if "name" in q else {**q, **name_q}
    items = await db.products.find(q, PUBLIC_PRODUCT_PROJ).to_list(1000)
    return sorted(items, key=lambda p: p.get("stock", 0) <= 0) if search else items

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"product_id": product_id}, PUBLIC_PRODUCT_PROJ)
    if not p:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return p


# ---------------- Shipping ----------------
SHIPPING = [
    {"code": "grab", "name": "Grab Express", "type": "instan", "eta": "30-60 menit", "cost": 15000, "fresh_ok": True},
    {"code": "gojek", "name": "Gojek Instan", "type": "instan", "eta": "30-60 menit", "cost": 14000, "fresh_ok": True},
    {"code": "jne", "name": "JNE Reguler", "type": "reguler", "eta": "2-3 hari", "cost": 9000, "fresh_ok": False},
    {"code": "jnt", "name": "J&T Express", "type": "reguler", "eta": "2-3 hari", "cost": 10000, "fresh_ok": False},
]

@api_router.get("/shipping")
async def shipping_options(has_fresh: bool = True):
    if has_fresh:
        return [s for s in SHIPPING if s["fresh_ok"]]
    return SHIPPING


COURIER_META = {
    "grab": {"name": "Grab Express", "type": "instan", "fresh_ok": True},
    "gojek": {"name": "Gojek Instan", "type": "instan", "fresh_ok": True},
    "jne": {"name": "JNE Reguler", "type": "reguler", "fresh_ok": False},
    "jnt": {"name": "J&T Express", "type": "reguler", "fresh_ok": False},
    "paxel": {"name": "Paxel", "type": "reguler", "fresh_ok": False, "cold_ok": True},
}

class RateReq(BaseModel):
    destination_postal_code: Optional[int] = None
    destination_area_id: Optional[str] = None
    has_fresh: bool = True
    has_cold: bool = False
    weight: int = 1000
    value: int = 50000

@api_router.get("/shipping/areas")
async def shipping_areas(q: str):
    if not BITESHIP_API_KEY:
        raise HTTPException(status_code=503, detail="Biteship belum dikonfigurasi")
    r = requests.get("https://api.biteship.com/v1/maps/areas",
                     headers={"Authorization": BITESHIP_API_KEY},
                     params={"countries": "ID", "input": q, "type": "single"}, timeout=20)
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail="Gagal mencari area")
    return r.json().get("areas", [])

def _rate_option(p: dict) -> dict:
    code = p["courier_code"]
    meta = COURIER_META[code]
    rng = p.get("shipment_duration_range")
    eta = f"{rng} {p.get('shipment_duration_unit', '')}".strip() if rng else (p.get("duration") or "-")
    for en, idn in (("days", "hari"), ("day", "hari"), ("hours", "jam"), ("hour", "jam")):
        eta = eta.replace(en, idn)
    return {"code": code, "name": meta["name"], "type": meta["type"], "eta": eta,
            "cost": int(p.get("price") or 0), "service": p.get("courier_service_name", ""),
            "service_code": p.get("courier_service_code", ""),
            "fresh_ok": meta["fresh_ok"], "source": "biteship"}

def _cheapest_per_courier(pricing: list) -> list:
    best = {}
    for p in pricing:
        if p.get("courier_code") not in COURIER_META:
            continue
        opt = _rate_option(p)
        if opt["code"] not in best or opt["cost"] < best[opt["code"]]["cost"]:
            best[opt["code"]] = opt
    return list(best.values())

def _biteship_rates(data: RateReq) -> list:
    payload = {
        "origin_postal_code": int(BITESHIP_ORIGIN_POSTAL),
        "couriers": "grab,gojek" if data.has_fresh else "grab,gojek,paxel" if data.has_cold else "grab,gojek,jne,jnt",
        "items": [{"name": f"Belanja {BRAND['shortName']}", "value": max(data.value, 1000), "quantity": 1, "weight": max(data.weight, 100)}],
    }
    if data.destination_area_id:
        payload["destination_area_id"] = data.destination_area_id
    if data.destination_postal_code:
        payload["destination_postal_code"] = data.destination_postal_code
    try:
        r = requests.post("https://api.biteship.com/v1/rates/couriers",
                          headers={"Authorization": BITESHIP_API_KEY, "Content-Type": "application/json"},
                          json=payload, timeout=25)
        body = r.json()
    except (requests.RequestException, ValueError):
        return []
    if r.status_code != 200 or not body.get("pricing"):
        return []
    return _cheapest_per_courier(body["pricing"])

STORE_COURIER = "Kurir Toko"
PADANG_CITY_RE = CITY["matchRegex"]  # kota layanan Kurir Toko / COD (brand.config.json)

def is_store_courier(name) -> bool:
    return (name or "").strip().lower() == STORE_COURIER.lower()

def _with_store_courier(options: list) -> list:
    inst = [o for o in options if o["code"] in ("grab", "gojek")]
    if not inst:
        return options
    cheapest = min(inst, key=lambda o: o["cost"])
    return options + [{"code": "toko", "name": STORE_COURIER, "type": "instan", "eta": "Sesuai jadwal",
                       "cost": cheapest["cost"], "fresh_ok": True, "source": cheapest["source"], "cod_only": True,
                       "service": f"Tarif setara {cheapest['name']}", "service_code": ""}]

@api_router.post("/shipping/rates")
async def shipping_rates(data: RateReq):
    if BITESHIP_API_KEY and (data.destination_postal_code or data.destination_area_id):
        options = _biteship_rates(data)
        if options:
            have = {o["code"] for o in options}
            options += [{**s, "source": "flat"} for s in SHIPPING if s["fresh_ok"] and s["code"] not in have]
        if options:
            return _with_store_courier(options)
    base = [s for s in SHIPPING if s["fresh_ok"]] if data.has_fresh or data.has_cold else SHIPPING
    return _with_store_courier([{**s, "source": "flat"} for s in base])


# ---------------- Vouchers ----------------
VOUCHERS_SEED = [
    {"code": "FROZENHEMAT", "type": "percentage", "value": 10, "max_discount": 15000, "min_purchase": 50000,
     "description": "Diskon 10% (maks Rp15.000), min belanja Rp50.000", "active": True},
    {"code": "ONGKIRGRATIS", "type": "free_shipping", "value": 0, "max_discount": 0, "min_purchase": 30000,
     "description": "Gratis ongkir, min belanja Rp30.000", "active": True},
    {"code": "PASBAR25", "type": "fixed", "value": 25000, "max_discount": 25000, "min_purchase": 100000,
     "description": "Potongan Rp25.000, min belanja Rp100.000", "active": True},
]

class VoucherInput(BaseModel):
    code: str
    type: str
    value: int = 0
    max_discount: int = 0
    min_purchase: int = 0
    description: str = ""
    active: bool = True

class VoucherValidate(BaseModel):
    code: str
    subtotal: int

@api_router.get("/vouchers")
async def list_vouchers():
    return await db.vouchers.find({"active": True}, {"_id": 0}).to_list(100)

async def get_optional_user(request: Request):
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

async def has_previous_order(user_id: str) -> bool:
    return await db.orders.count_documents({"user_id": user_id, "status": {"$ne": "Dibatalkan"}}, limit=1) > 0

@api_router.post("/vouchers/validate")
async def validate_voucher(data: VoucherValidate, user=Depends(get_optional_user)):
    return await compute_voucher(data.code, data.subtotal, user)

async def compute_voucher(code: str, subtotal: int, user=None):
    v = await db.vouchers.find_one({"code": code.strip().upper(), "active": True}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Kode voucher tidak valid")
    if v.get("first_order"):
        if not user:
            raise HTTPException(status_code=400, detail="Masuk dulu untuk memakai voucher transaksi pertama")
        if await has_previous_order(user["user_id"]):
            raise HTTPException(status_code=400, detail="Voucher ini khusus transaksi pertama")
    if subtotal < v["min_purchase"]:
        raise HTTPException(status_code=400, detail=f"Minimal belanja Rp{v['min_purchase']:,}".replace(",", "."))
    discount, free_shipping, ship_discount = 0, False, 0
    if v["type"] == "percentage":
        discount = round(subtotal * v["value"] / 100)
        if v.get("max_discount"):
            discount = min(discount, v["max_discount"])
    elif v["type"] == "fixed":
        discount = v["value"]
    elif v["type"] == "free_shipping":
        free_shipping = True
    elif v["type"] == "shipping_discount":
        ship_discount = v["value"]
    return {"code": v["code"], "type": v["type"], "discount": discount, "ship_discount": ship_discount,
            "free_shipping": free_shipping, "description": v["description"]}


# ---------------- Delivery schedule ----------------
def build_schedule():
    now = datetime.now(WIB)
    labels = ["Hari ini", "Besok", "Lusa"]
    days = []
    for i, label in enumerate(labels):
        d = (now + timedelta(days=i)).date()
        slots = []
        for s in DELIVERY_SLOTS:
            start_h = int(s[:2])
            available = i > 0 or now + timedelta(minutes=30) <= now.replace(hour=start_h, minute=0, second=0, microsecond=0)
            slots.append({"slot": s, "available": available})
        days.append({"date": d.isoformat(), "label": label, "slots": slots})
    return days

@api_router.get("/shipping/schedule")
async def delivery_schedule():
    return build_schedule()


# ---------------- Addresses ----------------
@api_router.get("/addresses")
async def list_addresses(user=Depends(get_current_user)):
    return await db.addresses.find({"user_id": user["user_id"]}, {"_id": 0}).sort("is_default", -1).to_list(50)

async def _set_default(user_id: str, address_id: str):
    await db.addresses.update_many({"user_id": user_id, "address_id": {"$ne": address_id}}, {"$set": {"is_default": False}})

@api_router.post("/addresses")
async def create_address(data: AddressInput, user=Depends(get_current_user)):
    doc = {"address_id": f"addr_{uuid.uuid4().hex[:10]}", "user_id": user["user_id"], **data.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    if await db.addresses.count_documents({"user_id": user["user_id"]}) == 0:
        doc["is_default"] = True
    await db.addresses.insert_one(dict(doc))
    if doc["is_default"]:
        await _set_default(user["user_id"], doc["address_id"])
    return clean(doc)

@api_router.put("/addresses/{address_id}")
async def update_address(address_id: str, data: AddressInput, user=Depends(get_current_user)):
    r = await db.addresses.update_one({"address_id": address_id, "user_id": user["user_id"]}, {"$set": data.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alamat tidak ditemukan")
    if data.is_default:
        await _set_default(user["user_id"], address_id)
    return await db.addresses.find_one({"address_id": address_id}, {"_id": 0})

@api_router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, user=Depends(get_current_user)):
    await db.addresses.delete_one({"address_id": address_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------- Midtrans ----------------
MIDTRANS_CHANNELS = {
    "qris": ["other_qris", "gopay", "shopeepay"],
    "va": ["bca_va", "bni_va", "bri_va", "permata_va", "echannel", "cimb_va", "other_va"],
}

PAY_CREATE_ERROR = {
    "qris": "QRIS sedang tidak bisa dibuat. Coba lagi beberapa saat, atau pilih Virtual Account.",
    "va": "Virtual Account sedang tidak bisa dibuat. Coba lagi beberapa saat, atau pilih QRIS.",
}

def _snap_request(order: dict, channels: list):
    payload = {
        "transaction_details": {"order_id": order["order_id"], "gross_amount": order["total"]},
        "customer_details": {"first_name": order["address"].get("name", ""), "phone": order["address"].get("phone", ""),
                             "email": order.get("user_email", "")},
        "enabled_payments": channels,
        "expiry": {"unit": "minutes", "duration": 60},
    }
    try:
        r = requests.post(f"{SNAP_BASE}/snap/v1/transactions", auth=(MIDTRANS_SERVER_KEY, ""), json=payload, timeout=20)
    except requests.RequestException as e:
        logger.error(f"Midtrans snap unreachable: {e}")
        return None
    if r.status_code not in (200, 201):
        logger.error(f"Midtrans snap error {r.status_code} {channels}: {r.text[:300]}")
        return None
    return r.json()

def midtrans_create(order: dict):
    method = order["payment_method"]
    # QRIS: open Snap straight on the QR page (one channel = no channel picker),
    # falling back to the full e-wallet list if Midtrans rejects QRIS-only.
    attempts = [["other_qris"], MIDTRANS_CHANNELS[method]] if method == "qris" else [MIDTRANS_CHANNELS[method]]
    for channels in attempts:
        snap = _snap_request(order, channels)
        if snap and snap.get("token"):
            return snap
    raise HTTPException(status_code=400, detail=PAY_CREATE_ERROR.get(method, "Pembayaran sedang tidak bisa dibuat. Coba lagi beberapa saat."))

MIDTRANS_API = "https://api.midtrans.com" if MIDTRANS_PRODUCTION else "https://api.sandbox.midtrans.com"

def midtrans_qris(order: dict) -> dict:
    body = {
        "payment_type": "qris",
        "transaction_details": {"order_id": order["order_id"], "gross_amount": order["total"]},
        "customer_details": {"first_name": order["address"].get("name", ""), "phone": order["address"].get("phone", ""),
                             "email": order.get("user_email", "")},
        "custom_expiry": {"expiry_duration": 15, "unit": "minute"},
    }
    r = requests.post(f"{MIDTRANS_API}/v2/charge", auth=(MIDTRANS_SERVER_KEY, ""), json=body, timeout=20,
                      headers={"Accept": "application/json"})
    try:
        d = r.json()
    except ValueError:
        d = {}
    if r.status_code >= 300 or d.get("transaction_status") != "pending":
        logger.error(f"Midtrans QRIS error {r.status_code}: {str(d)[:300] or r.text[:300]}")
        raise HTTPException(status_code=400, detail="Gagal membuat QRIS. Pastikan QRIS Core API aktif di Midtrans, atau pilih Virtual Account")
    url = next((a.get("url") for a in d.get("actions", []) if a.get("name") in ("generate-qr-code-v2", "generate-qr-code")), "")
    return {"qr_url": url, "qr_string": d.get("qr_string", ""), "expires_at": d.get("expiry_time", ""), "acquirer": d.get("acquirer", "")}

async def apply_midtrans_status(order_id: str, body: dict):
    status = body.get("transaction_status")
    fraud = body.get("fraud_status", "accept")
    update = {"payment_status": status, "payment_type": body.get("payment_type", "")}
    if status in ("settlement", "capture") and fraud == "accept":
        update["status"] = "Diproses"
        update["paid_at"] = datetime.now(timezone.utc).isoformat()
    elif status in ("expire", "cancel", "deny"):
        update["status"] = "Dibatalkan"
    r = await db.orders.update_one({"order_id": order_id, "status": "Menunggu Pembayaran"}, {"$set": update})
    await db.orders.update_one({"order_id": order_id}, {"$set": {"payment_status": status}})
    if r.modified_count and update.get("status") == "Dibatalkan":
        o = await db.orders.find_one({"order_id": order_id}, {"_id": 0, "items": 1})
        await adjust_stock(o["items"], 1)
        await release_flash(o["items"])
    if r.modified_count and update.get("status") == "Diproses":
        notify_bg(order_id, "paid")
        notify_owners_bg(order_id)

@api_router.get("/payments/config")
async def payments_config():
    return {"client_key": MIDTRANS_CLIENT_KEY, "snap_url": f"{SNAP_BASE}/snap/snap.js", "production": MIDTRANS_PRODUCTION}

@api_router.post("/payments/midtrans/notification")
async def midtrans_notification(request: Request):
    body = await request.json()
    oid, sc, ga, sig = body.get("order_id"), body.get("status_code"), body.get("gross_amount"), body.get("signature_key")
    if not all([oid, sc, ga, sig]):
        raise HTTPException(status_code=400, detail="Invalid notification")
    expected = hashlib.sha512(f"{oid}{sc}{ga}{MIDTRANS_SERVER_KEY}".encode()).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")
    if oid.startswith("TOP"):
        t = await db.topups.find_one({"topup_id": oid}, {"_id": 0})
        if not t or int(float(ga)) != t["amount"]:
            raise HTTPException(status_code=400, detail="Top up tidak valid")
        await apply_topup_status(oid, body)
        return {"ok": True}
    o = await db.orders.find_one({"order_id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    if int(float(ga)) != o["total"]:
        raise HTTPException(status_code=400, detail="Amount mismatch")
    await apply_midtrans_status(oid, body)
    return {"ok": True}

@api_router.get("/orders/{order_id}/payment-status")
async def order_payment_status(order_id: str, user=Depends(get_current_user)):
    o = await db.orders.find_one({"order_id": order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if o["payment_method"] in MIDTRANS_CHANNELS:
        r = requests.get(f"{CORE_BASE}/v2/{order_id}/status", auth=(MIDTRANS_SERVER_KEY, ""), timeout=20)
        body = r.json() if r.ok else {}
        if body.get("transaction_status") and int(float(body.get("gross_amount", 0))) == o["total"]:
            await apply_midtrans_status(order_id, body)
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


# ---------------- Orders ----------------
def _price_line(it, p: dict) -> dict:
    if p.get("variants"):
        v = next((v for v in p["variants"] if v["variant_id"] == it.variant_id), None)
        if not v:
            raise HTTPException(status_code=400, detail=f"Pilih varian untuk {p['name']}")
        if v.get("stock", 0) < it.quantity:
            raise HTTPException(status_code=400, detail=f"Stok {p['name']} ({v['name']}) tidak cukup")
        disc = p.get("discount", 0)
        price = round(v["price"] * (1 - disc / 100)) if disc else v["price"]
        return {**it.model_dump(), "variant_name": v["name"], "price": price, "hpp": v.get("hpp", 0), "fresh": p.get("fresh", False),
                "cold": p.get("cold", False), "weight": v.get("weight") or p.get("weight") or 500}
    if p.get("stock", 0) < it.quantity:
        raise HTTPException(status_code=400, detail=f"Stok {p['name']} tidak cukup")
    return {**it.model_dump(), "variant_id": None, "price": p.get("final_price") or p["price"], "hpp": p.get("hpp", 0),
            "fresh": p.get("fresh", False), "cold": p.get("cold", False), "weight": p.get("weight") or 500}

def wib_today() -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=7)).date().isoformat()

async def reserve_flash(items) -> bool:
    done = []
    for it in items:
        if not it.get("flash_id"):
            continue
        r = await db.flash_items.update_one(
            {"flash_id": it["flash_id"], "$expr": {"$lte": [{"$add": ["$sold", it["quantity"]]}, "$quota"]}},
            {"$inc": {"sold": it["quantity"]}})
        if not r.modified_count:
            await release_flash(done)
            return False
        done.append(it)
    return True

async def release_flash(items):
    for it in items:
        if it.get("flash_id"):
            await db.flash_items.update_one({"flash_id": it["flash_id"], "sold": {"$gte": it["quantity"]}},
                                            {"$inc": {"sold": -it["quantity"]}})

class FlashItemInput(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    product_id: str
    variant_id: Optional[str] = None
    flash_price: int = Field(gt=0)
    quota: int = Field(ge=1, le=100000)

async def _flash_view(f: dict) -> Optional[dict]:
    p = await db.products.find_one({"product_id": f["product_id"]}, {"_id": 0})
    if not p:
        return None
    v = next((x for x in p.get("variants") or [] if x["variant_id"] == f.get("variant_id")), None)
    normal = (round(v["price"] * (1 - p.get("discount", 0) / 100)) if p.get("discount") else v["price"]) if v else (p.get("final_price") or p["price"])
    return {**f, "remaining": max(0, f["quota"] - f["sold"]), "normal_price": normal,
            "variant_name": v["name"] if v else None, "product": p}

@api_router.get("/flash-sale")
async def flash_sale_today():
    out = []
    for f in await db.flash_items.find({"date": wib_today()}, {"_id": 0}).sort("created_at", 1).to_list(200):
        fv = await _flash_view(f)
        if fv and fv["product"].get("active", True):
            out.append(fv)
    return out

@api_router.get("/admin/flash-sale")
async def admin_flash_list(date: str, user=Depends(require_admin)):
    out = []
    for f in await db.flash_items.find({"date": date}, {"_id": 0}).sort("created_at", 1).to_list(500):
        fv = await _flash_view(f)
        if fv:
            out.append(fv)
    return out

async def _check_flash(data: FlashItemInput, exclude: str = "") -> None:
    if data.date < wib_today():
        raise HTTPException(status_code=400, detail="Tanggal flash sale tidak boleh lewat")
    p = await db.products.find_one({"product_id": data.product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    if p.get("variants") and not any(v["variant_id"] == data.variant_id for v in p["variants"]):
        raise HTTPException(status_code=400, detail="Pilih varian produk")
    if not p.get("variants"):
        data.variant_id = None
    fv = await _flash_view({"product_id": data.product_id, "variant_id": data.variant_id, "quota": data.quota, "sold": 0})
    if data.flash_price >= fv["normal_price"]:
        raise HTTPException(status_code=400, detail=f"Harga flash harus di bawah harga normal ({fv['normal_price']})")
    dup = await db.flash_items.find_one({"date": data.date, "product_id": data.product_id, "variant_id": data.variant_id,
                                         "flash_id": {"$ne": exclude}})
    if dup:
        raise HTTPException(status_code=400, detail="Produk/varian ini sudah ada di flash sale tanggal tersebut")

@api_router.post("/admin/flash-sale")
async def admin_flash_create(data: FlashItemInput, user=Depends(require_admin)):
    await _check_flash(data)
    doc = {**data.model_dump(), "flash_id": f"fs_{uuid.uuid4().hex[:10]}", "sold": 0, "created_at": now_iso()}
    await db.flash_items.insert_one(dict(doc))
    return await _flash_view(doc)

@api_router.put("/admin/flash-sale/{flash_id}")
async def admin_flash_update(flash_id: str, data: FlashItemInput, user=Depends(require_admin)):
    f = await db.flash_items.find_one({"flash_id": flash_id}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="Item flash sale tidak ditemukan")
    await _check_flash(data, exclude=flash_id)
    if data.quota < f["sold"]:
        raise HTTPException(status_code=400, detail=f"Kuota tidak boleh kurang dari yang sudah terjual ({f['sold']})")
    await db.flash_items.update_one({"flash_id": flash_id}, {"$set": data.model_dump()})
    return await _flash_view(await db.flash_items.find_one({"flash_id": flash_id}, {"_id": 0}))

@api_router.delete("/admin/flash-sale/{flash_id}")
async def admin_flash_delete(flash_id: str, user=Depends(require_admin)):
    await db.flash_items.delete_one({"flash_id": flash_id})
    return {"ok": True}

def week_start_wib() -> str:
    d = (datetime.now(timezone.utc) + timedelta(hours=7)).date()
    return (d - timedelta(days=d.weekday())).isoformat()

async def active_recipe_promo() -> Optional[dict]:
    pr = await db.settings.find_one({"key": "recipe_promo"}, {"_id": 0})
    if not pr or pr.get("week_start") != week_start_wib():
        return None
    r = await db.recipes.find_one({"recipe_id": pr["recipe_id"], "published": True}, {"_id": 0})
    if not r:
        return None
    pids = [i["product_id"] for i in r["ingredients"] if i.get("product_id")]
    return {**pr, "recipe": r, "product_ids": pids}

async def _price_items(raw_items) -> tuple:
    items = []
    promo = await active_recipe_promo()
    flash = {(f["product_id"], f.get("variant_id") or None): f
             for f in await db.flash_items.find({"date": wib_today()}, {"_id": 0}).to_list(500)}
    promos = {}
    for x in await _active_promo_docs():
        k = (x["product_id"], x.get("variant_id") or None)
        if k not in promos or x["promo_price"] < promos[k]["promo_price"]:
            promos[k] = x
    for it in raw_items:
        p = await db.products.find_one({"product_id": it.product_id, "active": True}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=400, detail=f"Produk {it.name} tidak tersedia")
        line = _price_line(it, p)
        line["name"], line["image"] = p["name"], p.get("image") or line.get("image", "")
        if promo and it.recipe_id == promo["recipe_id"] and it.product_id in promo["product_ids"]:
            line["price"] = round(line["price"] * (1 - promo["discount_pct"] / 100))
            line["recipe_promo"] = True
        else:
            line["recipe_id"] = None
            key = (it.product_id, line.get("variant_id") or None)
            f = flash.get(key)
            if f and f["quota"] - f["sold"] >= it.quantity and f["flash_price"] < line["price"]:
                line["price"], line["flash_id"] = f["flash_price"], f["flash_id"]
            pr = promos.get(key)
            if pr and pr["promo_price"] < line["price"]:
                line.pop("flash_id", None)
                line["price"], line["promo_id"] = pr["promo_price"], pr["promo_id"]
        items.append(line)
    return items, sum(i["price"] * i["quantity"] for i in items)

async def _quote_shipping(data: OrderInput, items: list, subtotal: int) -> dict:
    postal = _re.sub(r"\D", "", str(data.address.get("postal") or ""))
    req = RateReq(destination_postal_code=int(postal) if len(postal) == 5 else None,
                  destination_area_id=data.address.get("area_id") or None,
                  has_fresh=any(i.get("fresh") for i in items), has_cold=any(i.get("cold") for i in items),
                  weight=sum(i["quantity"] * i.get("weight", 500) for i in items) or 500, value=subtotal)
    options = await shipping_rates(req)
    opt = next((o for o in options if o["name"] == data.courier), None)
    if not opt:
        raise HTTPException(status_code=400, detail="Tarif kurir berubah atau tidak tersedia, silakan pilih ulang jasa kirim")
    return opt


async def _order_totals(data: OrderInput, subtotal: int, quoted_cost: int, user=None) -> tuple:
    discount, free_ship, ship_disc = 0, False, 0
    if data.voucher_code:
        v = await compute_voucher(data.voucher_code, subtotal, user)
        discount = min(v["discount"], subtotal)
        free_ship = v["free_shipping"]
        ship_disc = v["ship_discount"]
    shipping_cost = 0 if free_ship else max(0, quoted_cost - ship_disc)
    return discount, shipping_cost, max(0, subtotal + shipping_cost - discount)

PO_RE = _re.compile(r"PO\s*H\s*\+\s*1", _re.I)

def _validate_instant(data: OrderInput):
    if data.courier_type != "instan":
        a = data.address
        if not _re.fullmatch(r"\d{5}", str(a.get("postal") or "")) or not str(a.get("district") or "").strip():
            raise HTTPException(status_code=400, detail="Untuk JNE/J&T/Paxel lengkapi kecamatan dan kode pos alamat")
        return
    if data.address.get("lat") is None or data.address.get("lng") is None:
        raise HTTPException(status_code=400, detail="Tandai lokasi pengiriman di peta untuk kurir instan")
    day = next((d for d in build_schedule() if d["date"] == data.delivery_date), None)
    slot = day and next((s for s in day["slots"] if s["slot"] == data.delivery_slot), None)
    if not slot or not slot["available"]:
        raise HTTPException(status_code=400, detail="Pilih jadwal pengiriman yang tersedia")

@api_router.post("/orders")
async def create_order(data: OrderInput, user=Depends(get_current_user)):
    if data.payment_method not in ("cod", "qris", "va", "saldo"):
        raise HTTPException(status_code=400, detail="Metode pembayaran tidak didukung")
    if not data.items:
        raise HTTPException(status_code=400, detail="Keranjang kosong")
    store_courier = is_store_courier(data.courier)
    if data.payment_method == "cod" and not store_courier:
        raise HTTPException(status_code=400, detail="Pembayaran COD hanya bisa dengan Kurir Toko")
    if store_courier and data.payment_method != "cod":
        raise HTTPException(status_code=400, detail="Kurir Toko hanya untuk pembayaran COD")
    if store_courier and not _re.match(PADANG_CITY_RE, str(data.address.get("city") or ""), _re.I):
        raise HTTPException(status_code=400, detail=f"Kurir Toko (COD) hanya untuk alamat di {CITY['name']}. Lengkapi kecamatan/kota alamat Anda")
    items, subtotal = await _price_items(data.items)
    quote = await _quote_shipping(data, items, subtotal)
    data.courier_type = quote["type"]
    data.courier_service_code = quote.get("service_code", "")
    discount, shipping_cost, total = await _order_totals(data, subtotal, quote["cost"], user)
    _validate_instant(data)
    if data.courier_type == "instan" and any(PO_RE.search(i["name"]) for i in items) and data.delivery_date == datetime.now(WIB).date().isoformat():
        raise HTTPException(status_code=400, detail="Keranjang berisi produk Pre Order H+1, pilih jadwal kirim mulai besok")
    order_id = f"ORD{datetime.now().strftime('%y%m%d')}{uuid.uuid4().hex[:5].upper()}"
    status = "Diproses" if data.payment_method in ("cod", "saldo") else "Menunggu Pembayaran"
    order = {
        "order_id": order_id, "user_id": user["user_id"], "user_name": user["name"], "user_email": user["email"],
        **data.model_dump(), "items": items, "subtotal": subtotal, "discount": discount,
        "shipping_cost": shipping_cost, "total": total, "status": status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    aff = await affiliate_for_order(data.ref_code, user, items)
    if aff:
        order["affiliate"] = aff
    if not await reserve_stock(items):
        raise HTTPException(status_code=400, detail="Stok berubah, beberapa produk tidak cukup. Periksa keranjang Anda")
    if not await reserve_flash(items):
        await adjust_stock(items, 1)
        raise HTTPException(status_code=400, detail="Kuota flash sale baru saja habis. Muat ulang keranjang untuk harga terbaru")
    try:
        qris = None
        if data.payment_method == "qris":
            try:
                qris = await asyncio.to_thread(midtrans_qris, order)
            except HTTPException:
                logger.warning("QRIS Core API unavailable, falling back to Snap")
        if qris:
            order["qris"] = qris
            order["payment_status"] = "pending"
        elif data.payment_method in MIDTRANS_CHANNELS:
            snap = await asyncio.to_thread(midtrans_create, order)
            order["snap_token"] = snap["token"]
            order["snap_redirect_url"] = snap.get("redirect_url", "")
            order["payment_status"] = "pending"
        if data.payment_method == "saldo":
            if not await wallet_debit(user["user_id"], total, "payment", order_id, f"Pembayaran pesanan {order_id}"):
                raise HTTPException(status_code=400, detail="Saldo tidak cukup")
            order["paid_at"] = order["created_at"]
    except Exception:
        await adjust_stock(items, 1)
        await release_flash(items)
        raise
    await db.orders.insert_one(dict(order))
    await db.carts.delete_one({"user_id": user["user_id"]})
    notify_bg(order_id, "created")
    if data.payment_method == "saldo":
        notify_owners_bg(order_id)
    return clean(order)

@api_router.get("/orders")
async def my_orders(user=Depends(get_current_user)):
    items = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


# ---------------- Banners & files ----------------
storage_key = None

def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    r.raise_for_status()
    storage_key = r.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(), "Content-Type": content_type},
                     data=data, timeout=120)
    if r.status_code == 404:
        r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(True), "Content-Type": content_type},
                         data=data, timeout=120)
    r.raise_for_status()
    return r.json()

def get_object(path: str):
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage()}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

def sniff_image(data: bytes) -> Optional[tuple]:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None

async def store_image(file: UploadFile, folder: str) -> str:
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran gambar maks 5MB")
    kind = sniff_image(data)
    if not kind:
        raise HTTPException(status_code=400, detail="Hanya foto JPG, PNG, atau WebP yang diizinkan")
    ctype, ext = kind
    return await save_image_bytes(data, ctype, ext, folder, file.filename)

async def save_image_bytes(data: bytes, ctype: str, ext: str, folder: str, filename: str) -> str:
    result = put_object(f"{APP_NAME}/{folder}/{uuid.uuid4()}.{ext}", data, ctype)
    await db.files.insert_one({"id": str(uuid.uuid4()), "storage_path": result["path"], "original_filename": filename,
                               "content_type": ctype, "size": result.get("size"), "is_deleted": False,
                               "created_at": datetime.now(timezone.utc).isoformat()})
    return f"/api/files/{result['path']}"

@api_router.post("/admin/upload")
async def admin_upload(file: UploadFile = File(...), user=Depends(require_admin)):
    return {"url": await store_image(file, "uploads")}

@api_router.get("/files/{path:path}")
async def get_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    data, ct = get_object(path)
    return Response(content=data, media_type=rec.get("content_type") or ct, headers={"Cache-Control": "public, max-age=86400"})

@api_router.get("/banners")
async def list_banners():
    return await db.banners.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(20)

@api_router.get("/admin/banners")
async def admin_list_banners(user=Depends(require_admin)):
    return await db.banners.find({}, {"_id": 0}).sort("order", 1).to_list(50)

@api_router.post("/admin/banners")
async def admin_create_banner(data: BannerInput, user=Depends(require_admin)):
    doc = {"banner_id": f"bn_{uuid.uuid4().hex[:8]}", **data.model_dump()}
    await db.banners.insert_one(dict(doc))
    return clean(doc)

@api_router.put("/admin/banners/{banner_id}")
async def admin_update_banner(banner_id: str, data: BannerInput, user=Depends(require_admin)):
    await db.banners.update_one({"banner_id": banner_id}, {"$set": data.model_dump()})
    return await db.banners.find_one({"banner_id": banner_id}, {"_id": 0})

@api_router.delete("/admin/banners/{banner_id}")
async def admin_delete_banner(banner_id: str, user=Depends(require_admin)):
    await db.banners.delete_one({"banner_id": banner_id})
    return {"ok": True}


# ---------------- Admin ----------------
@api_router.get("/admin/products")
async def admin_products(user=Depends(require_admin)):
    return await db.products.find({}, {"_id": 0}).to_list(5000)

DEFAULT_PRODUCT_IMG = "https://down-id.img.susercontent.com/file/ddf34ef69c127a501f70ea80a873c36b"

class ProductCreate(BaseModel):
    name: str = Field(min_length=1)
    category: str
    price: int = Field(ge=0)
    hpp: int = Field(default=0, ge=0)
    store_price: int = Field(default=0, ge=0)  # harga toko (kasir); 0 = ikut harga web
    stock: int = Field(default=0, ge=0)
    discount: int = Field(default=0, ge=0, le=90)
    unit: str = "pcs"
    image: str = ""
    description: str = ""
    active: bool = True
    variants: List[Variant] = []
    weight: int = Field(default=500, ge=1, le=50000)

class BulkUpdate(BaseModel):
    product_ids: List[str] = Field(min_length=1)
    category: Optional[str] = None
    stock: Optional[int] = Field(default=None, ge=0)
    discount: Optional[int] = Field(default=None, ge=0, le=90)
    active: Optional[bool] = None
    archived: Optional[bool] = None

from catalog_sync import VEG as VEG_CATEGORIES, is_cold  # noqa: E402

async def product_fields(update: dict, existing: Optional[dict] = None) -> dict:
    if "name" in update and not str(update["name"]).strip():
        raise HTTPException(status_code=400, detail="Nama produk wajib diisi")
    if "category" in update:
        cat = await db.categories.find_one({"slug": update["category"]}, {"_id": 0})
        if not cat or cat.get("virtual"):
            raise HTTPException(status_code=400, detail=f"Kategori tidak valid: {update['category']}")
        update["category_name"] = cat["name"]
        name = str(update.get("name") or (existing or {}).get("name") or "")
        update["fresh"] = update["category"] in VEG_CATEGORIES
        update["cold"] = is_cold(update["category"], name)
    if update.get("variants"):
        vs = []
        for v in update["variants"]:
            v = dict(v)
            v["variant_id"] = v.get("variant_id") or f"v{uuid.uuid4().hex[:8]}"
            vs.append(v)
        update["variants"] = vs
        update["price"] = min(v["price"] for v in vs)
        update["stock"] = sum(v["stock"] for v in vs)
    if "stock" in update:
        update["in_stock"] = update["stock"] > 0
    if "price" in update or "discount" in update:
        price = update.get("price", (existing or {}).get("price", 0))
        disc = update.get("discount", (existing or {}).get("discount", 0))
        update["final_price"] = round(price * (1 - disc / 100)) if disc else price
    if update.get("archived") is True:
        update["active"] = False
    return update

async def create_product_doc(data: dict) -> dict:
    doc = {"product_id": f"rsp{uuid.uuid4().hex[:10]}", "sold": 0, "rating": 4.8, "best_seller": False,
           "new_arrival": True, "archived": False, **data}
    doc["image"] = doc.get("image") or DEFAULT_PRODUCT_IMG
    doc = await product_fields(doc)
    await db.products.insert_one(dict(doc))
    return clean(doc)

@api_router.post("/admin/products")
async def admin_create_product(data: ProductCreate, user=Depends(require_admin)):
    return await create_product_doc(data.model_dump())

@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, user=Depends(require_admin)):
    r = await db.products.delete_one({"product_id": product_id})
    if not r.deleted_count:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return {"ok": True}

@api_router.post("/admin/products/bulk")
async def admin_bulk_products(data: BulkUpdate, user=Depends(require_admin)):
    base = {k: v for k, v in data.model_dump().items() if v is not None and k != "product_ids"}
    if not base:
        raise HTTPException(status_code=400, detail="Pilih perubahan yang akan diterapkan")
    if data.archived is False:
        base["active"] = True
    n = 0
    for pid in data.product_ids:
        p = await db.products.find_one({"product_id": pid}, {"_id": 0})
        if p:
            await db.products.update_one({"product_id": pid}, {"$set": await product_fields(dict(base), p)})
            n += 1
    schedule_restock(data.product_ids)
    return {"updated": n}

@api_router.post("/admin/products/bulk-delete")
async def admin_bulk_delete(data: BulkUpdate, user=Depends(require_admin)):
    r = await db.products.delete_many({"product_id": {"$in": data.product_ids}})
    return {"deleted": r.deleted_count}

PRODUCT_COLS = ["product_id", "nama", "kategori", "harga", "hpp", "harga_toko", "diskon", "stok", "satuan", "aktif", "foto_url", "deskripsi", "berat_gram"]

@api_router.get("/admin/products/export.xlsx")
async def admin_products_export(user=Depends(require_admin)):
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Produk"
    ws.append(PRODUCT_COLS)
    for p in await db.products.find({"archived": {"$ne": True}}, {"_id": 0}).sort("name", 1).to_list(5000):
        ws.append([p["product_id"], p["name"], p.get("category", ""), p.get("price", 0), p.get("hpp", 0), p.get("store_price", 0), p.get("discount", 0),
                   p.get("stock", 0), p.get("unit", ""), "ya" if p.get("active") else "tidak", p.get("image", ""), p.get("description", ""),
                   p.get("weight", 500)])
    wc = wb.create_sheet("Kategori")
    wc.append(["kategori (isi di kolom kategori)", "nama"])
    for c in await db.categories.find({"virtual": {"$ne": True}}, {"_id": 0}).to_list(100):
        wc.append([c["slug"], c["name"]])
    return xlsx_response(wb, "produk-rak-sayur.xlsx")

def _num(v, default=None):
    s = str(v).strip()
    if s == "":
        return default
    if _re.fullmatch(r"\d{1,3}(\.\d{3})+", s):
        s = s.replace(".", "")
    return int(float(s.replace(",", "")))

@api_router.post("/admin/products/import")
async def admin_products_import(file: UploadFile = File(...), user=Depends(require_admin)):
    import io
    import pandas as pd
    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw), dtype=str) if file.filename.lower().endswith(".csv") else pd.read_excel(io.BytesIO(raw), dtype=str, engine="calamine", sheet_name=0)
    except Exception:
        raise HTTPException(status_code=400, detail="File tidak bisa dibaca (gunakan .xlsx atau .csv)")
    df.columns = [str(c).strip().lower() for c in df.columns]
    if "nama" not in df.columns:
        raise HTTPException(status_code=400, detail="Kolom wajib: nama (gunakan template export)")
    created, updated, errors = 0, 0, []
    for idx, row in df.fillna("").iterrows():
        line = idx + 2
        try:
            pid = str(row.get("product_id", "")).strip().split(".")[0]
            fields = {}
            for col, key in (("nama", "name"), ("kategori", "category"), ("satuan", "unit"), ("foto_url", "image"), ("deskripsi", "description")):
                if str(row.get(col, "")).strip():
                    fields[key] = str(row[col]).strip()
            for col, key in (("harga", "price"), ("hpp", "hpp"), ("harga_toko", "store_price"), ("diskon", "discount"), ("stok", "stock"), ("berat_gram", "weight")):
                n = _num(row.get(col, ""))
                if n is not None:
                    fields[key] = n
            if str(row.get("aktif", "")).strip():
                fields["active"] = str(row["aktif"]).strip().lower() in ("ya", "yes", "1", "true", "aktif")
            if not fields:
                continue
            existing = pid and await db.products.find_one({"product_id": pid}, {"_id": 0})
            if existing:
                await db.products.update_one({"product_id": pid}, {"$set": await product_fields(fields, existing)})
                updated += 1
                if "stock" in fields:
                    schedule_restock([pid])
            else:
                if not fields.get("name") or not fields.get("category") or "price" not in fields:
                    raise ValueError("produk baru wajib isi nama, kategori, harga")
                await create_product_doc(ProductCreate(**fields).model_dump())
                created += 1
        except HTTPException as e:
            errors.append(f"Baris {line}: {e.detail}")
        except Exception as e:
            errors.append(f"Baris {line}: {str(e)[:120]}")
    return {"created": created, "updated": updated, "errors": errors[:50]}

@api_router.patch("/admin/products/{product_id}")
async def admin_update_product(product_id: str, data: ProductUpdate, user=Depends(require_admin)):
    p = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    update = await product_fields({k: v for k, v in data.model_dump().items() if v is not None}, p)
    if update.get("archived") is False:
        update["active"] = True
    await db.products.update_one({"product_id": product_id}, {"$set": update})
    if "stock" in update or update.get("active") is True:
        schedule_restock([product_id])
    return await db.products.find_one({"product_id": product_id}, {"_id": 0})

@api_router.get("/admin/orders")
async def admin_orders(user=Depends(require_admin)):
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.patch("/admin/orders/{order_id}")
async def admin_update_order(order_id: str, data: OrderStatusUpdate, user=Depends(require_admin)):
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if o["status"] in ("Dibatalkan", "Selesai"):
        if data.status == o["status"]:
            return o
        raise HTTPException(status_code=400, detail=f"Pesanan berstatus {o['status']} tidak bisa diubah statusnya")
    if data.status == "Dibatalkan":
        if (o.get("shipment") or {}).get("status") in ACTIVE_SHIPMENT:
            raise HTTPException(status_code=400, detail="Batalkan pengiriman Biteship pesanan ini dulu sebelum membatalkan pesanan")
        await cancel_order_now(o, "admin", "")
        return await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    await db.orders.update_one({"order_id": order_id}, {"$set": {"status": data.status}})
    if data.status == "Selesai":
        await mark_completed(order_id)
    if data.status in ("Dikirim", "Selesai"):
        notify_bg(order_id, "shipped" if data.status == "Dikirim" else "delivered")
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})

# ---------------- Store settings & Biteship dispatch ----------------
class StoreSettings(BaseModel):
    store_name: str = Field(default=STORE_NAME, max_length=60)
    contact_name: str
    phone: str
    address: str
    postal: str = ""
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    owner_phones: List[str] = Field(default_factory=list, max_length=5)

ACTIVE_SHIPMENT = {"confirmed", "allocated", "picking_up", "picked", "dropping_off", "on_hold"}
CANCELLABLE = {"confirmed", "allocated", "picking_up"}

def biteship_call(method: str, path: str, **kw):
    r = requests.request(method, f"https://api.biteship.com{path}", timeout=25,
                         headers={"Authorization": BITESHIP_API_KEY, "Content-Type": "application/json"}, **kw)
    body = r.json() if r.content else {}
    if r.status_code >= 400 or body.get("success") is False:
        logger.error(f"Biteship {path} {r.status_code}: {str(body)[:300]}")
        raise HTTPException(status_code=400, detail=f"Biteship: {body.get('error') or body.get('message') or 'gagal'}")
    return body

def shipment_view(b: dict) -> dict:
    c = b.get("courier") or {}
    return {
        "biteship_order_id": b.get("id") or b.get("order_id"), "status": b.get("status"),
        "company": c.get("company"), "type": c.get("type"),
        "driver_name": c.get("driver_name") or c.get("name"), "driver_phone": c.get("driver_phone") or c.get("phone"),
        "driver_plate": c.get("driver_plate_number"), "tracking_link": c.get("link"),
        "tracking_id": c.get("tracking_id"), "waybill_id": c.get("waybill_id"),
        "history": c.get("history", []), "price": b.get("price"),
    }

async def save_shipment(order_id: str, ship: dict):
    upd = {f"shipment.{k}": v for k, v in ship.items() if v is not None}
    upd["shipment.updated_at"] = datetime.now(timezone.utc).isoformat()
    st = ship.get("status")
    if st in ("picked", "dropping_off"):
        upd["status"] = "Dikirim"
    elif st == "delivered":
        upd["status"] = "Selesai"
    await db.orders.update_one({"order_id": order_id}, {"$set": upd})
    if st == "delivered":
        await mark_completed(order_id)
    if st in ("allocated", "picking_up") and ship.get("driver_name"):
        notify_bg(order_id, "driver")
    elif st in ("picked", "dropping_off"):
        notify_bg(order_id, "shipped")
    elif st == "delivered":
        notify_bg(order_id, "delivered")

@api_router.get("/admin/settings/store")
async def get_store_settings(user=Depends(require_admin)):
    return await db.settings.find_one({"key": "store"}, {"_id": 0, "key": 0}) or {}

@api_router.put("/admin/settings/store")
async def put_store_settings(data: StoreSettings, user=Depends(require_admin)):
    doc = data.model_dump()
    doc["owner_phones"] = list(dict.fromkeys(normalize_phone(p) for p in data.owner_phones if p.strip()))
    await db.settings.update_one({"key": "store"}, {"$set": doc}, upsert=True)
    return doc

MAPS_HOSTS = {"maps.app.goo.gl", "goo.gl", "www.google.com", "google.com", "maps.google.com", "www.google.co.id", "google.co.id", "maps.google.co.id"}

def _is_maps_url(u: str) -> bool:
    from urllib.parse import urlparse
    p = urlparse(u)
    return p.scheme == "https" and p.hostname in MAPS_HOSTS and (p.hostname != "goo.gl" or p.path.startswith("/maps"))

def _follow_maps(url: str) -> str:
    for _ in range(5):
        r = requests.get(url, timeout=15, allow_redirects=False, headers={"User-Agent": "Mozilla/5.0"})
        nxt = r.headers.get("location")
        if r.status_code not in (301, 302, 303, 307, 308) or not nxt:
            return url
        nxt = requests.compat.urljoin(url, nxt)
        if not _is_maps_url(nxt):
            return nxt
        url = nxt
    return url

@api_router.get("/admin/settings/resolve-maps")
async def resolve_maps(url: str, user=Depends(require_admin)):
    import re
    if not _is_maps_url(url):
        raise HTTPException(status_code=400, detail="Link harus dari Google Maps")
    try:
        final = await asyncio.to_thread(_follow_maps, url)
    except requests.RequestException:
        raise HTTPException(status_code=400, detail="Link tidak bisa dibuka")
    for pat in (r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", r"@(-?\d+\.\d+),(-?\d+\.\d+)", r"[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)"):
        m = re.search(pat, final) or re.search(pat, url)
        if m:
            return {"lat": float(m.group(1)), "lng": float(m.group(2))}
    raise HTTPException(status_code=400, detail="Koordinat tidak ditemukan di link")

BITESHIP_COURIERS = {"grab": ("grab", "instant"), "gojek": ("gojek", "instant"), "jne": ("jne", "reg"), "j&t": ("jnt", "ez"),
                     "jnt": ("jnt", "ez"), "paxel": ("paxel", "small")}

def _courier_code(name: str) -> tuple:
    n = (name or "").lower()
    return next((v for k, v in BITESHIP_COURIERS.items() if k in n), (None, None))

@api_router.post("/admin/orders/{order_id}/dispatch")
async def dispatch_order(order_id: str, user=Depends(require_admin)):
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    company, ctype = _courier_code(o.get("courier"))
    ctype = o.get("courier_service_code") or ctype
    if is_store_courier(o.get("courier")):
        raise HTTPException(status_code=400, detail="Pesanan Kurir Toko diantar sendiri oleh toko, tidak lewat Biteship")
    if not company:
        raise HTTPException(status_code=400, detail="Kurir pesanan ini tidak didukung Biteship")
    instant = ctype == "instant"
    if o["status"] in ("Menunggu Pembayaran", "Dibatalkan", "Selesai"):
        raise HTTPException(status_code=400, detail=f"Pesanan berstatus {o['status']}")
    if (o.get("shipment") or {}).get("status") in ACTIVE_SHIPMENT:
        raise HTTPException(status_code=400, detail="Kurir sudah dipesan untuk pesanan ini")
    a = o.get("address") or {}
    if instant and a.get("lat") is None:
        raise HTTPException(status_code=400, detail="Pesanan tidak punya titik lokasi pembeli")
    if not instant and not str(a.get("postal", "")).isdigit():
        raise HTTPException(status_code=400, detail="Pesanan reguler butuh kode pos pembeli")
    store = await db.settings.find_one({"key": "store"}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=400, detail="Lengkapi Pengaturan Toko (titik jemput) dulu")
    attempt = (o.get("shipment_attempts") or 0) + 1
    body = {
        "reference_id": f"{order_id}-{attempt}",
        "shipper_contact_name": store.get("store_name") or STORE_NAME, "shipper_contact_phone": store["phone"],
        "origin_contact_name": store["contact_name"], "origin_contact_phone": store["phone"],
        "origin_address": store["address"], "origin_postal_code": int(store["postal"]) if store.get("postal", "").isdigit() else None,
        "origin_coordinate": {"latitude": store["lat"], "longitude": store["lng"]} if instant else None,
        "destination_contact_name": a.get("name", o["user_name"]), "destination_contact_phone": a.get("phone", ""),
        "destination_contact_email": o.get("user_email", ""),
        "destination_address": ", ".join(x for x in (a.get("full", ""), a.get("detail", ""), a.get("district", ""), a.get("city", ""), a.get("province", "")) if x),
        "destination_area_id": a.get("area_id") or None,
        "destination_postal_code": int(a["postal"]) if str(a.get("postal", "")).isdigit() else None,
        "destination_coordinate": {"latitude": a["lat"], "longitude": a["lng"]} if instant and a.get("lat") is not None else None,
        "destination_note": o.get("note", ""),
        "courier_company": company, "courier_type": ctype, "delivery_type": "now",
        "order_note": f"Pesanan {order_id} {STORE_NAME}",
        "metadata": {"order_id": order_id},
        "items": [{"name": i["name"][:60], "value": i["price"], "quantity": i["quantity"], "weight": i.get("weight", 500),
                   "length": 20, "width": 20, "height": 15,
                   "category": "frozen_food" if i.get("cold") else "groceries"} for i in o["items"]],
    }
    body = {k: v for k, v in body.items() if v is not None}
    res = biteship_call("POST", "/v1/orders", json=body)
    ship = shipment_view(res)
    await db.orders.update_one({"order_id": order_id}, {"$set": {"shipment": {}, "shipment_attempts": attempt}})
    await save_shipment(order_id, {**ship, "created_at": datetime.now(timezone.utc).isoformat()})
    return (await db.orders.find_one({"order_id": order_id}, {"_id": 0}))["shipment"]

@api_router.get("/orders/{order_id}/shipment")
async def order_shipment(order_id: str, user=Depends(get_current_user)):
    q = {"order_id": order_id} if user.get("role") == "admin" else {"order_id": order_id, "user_id": user["user_id"]}
    o = await db.orders.find_one(q, {"_id": 0})
    if not o or not o.get("shipment"):
        raise HTTPException(status_code=404, detail="Pengiriman belum diatur")
    s = o["shipment"]
    if s.get("status") in ACTIVE_SHIPMENT and s.get("biteship_order_id"):
        try:
            await save_shipment(order_id, shipment_view(biteship_call("GET", f"/v1/orders/{s['biteship_order_id']}")))
        except HTTPException:
            pass
    return (await db.orders.find_one({"order_id": order_id}, {"_id": 0}))["shipment"]

@api_router.post("/admin/orders/{order_id}/shipment/cancel")
async def cancel_shipment(order_id: str, user=Depends(require_admin)):
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    s = (o or {}).get("shipment") or {}
    if s.get("status") not in CANCELLABLE:
        raise HTTPException(status_code=400, detail="Pengiriman tidak bisa dibatalkan pada status ini")
    biteship_call("POST", f"/v1/orders/{s['biteship_order_id']}/cancel",
                  json={"cancellation_reason_code": "others", "cancellation_reason": "Dibatalkan oleh admin"})
    await save_shipment(order_id, {"status": "cancelled"})
    return (await db.orders.find_one({"order_id": order_id}, {"_id": 0}))["shipment"]

@api_router.get("/admin/settings/biteship-webhook")
async def biteship_webhook_url(request: Request, user=Depends(require_admin)):
    return {"url": f"{public_base(request)}/api/webhooks/biteship/{os.environ['BITESHIP_WEBHOOK_SECRET']}"}

@api_router.post("/webhooks/biteship/{secret}")
async def biteship_webhook(secret: str, request: Request):
    if not hmac.compare_digest(secret, os.environ["BITESHIP_WEBHOOK_SECRET"]):
        raise HTTPException(status_code=401, detail="Invalid webhook")
    try:
        p = await request.json()
    except Exception:
        return {"ok": True}
    bid = p.get("order_id")
    o = bid and await db.orders.find_one({"shipment.biteship_order_id": bid}, {"_id": 0, "order_id": 1})
    if o and p.get("event") in ("order.status", "order.waybill_id"):
        await save_shipment(o["order_id"], {
            "status": p.get("status"), "driver_name": p.get("courier_driver_name"),
            "driver_phone": p.get("courier_driver_phone"), "driver_plate": p.get("courier_driver_plate_number"),
            "tracking_link": p.get("courier_link"), "tracking_id": p.get("courier_tracking_id"),
            "waybill_id": p.get("courier_waybill_id"),
        })
    return {"ok": True}

# ---------------- Live chat ----------------
class ChatInput(BaseModel):
    text: str = Field(default="", max_length=2000)
    image_url: Optional[str] = None
    order_id: Optional[str] = None

async def post_message(conv_user: dict, sender: str, data: ChatInput):
    if not data.text.strip() and not data.image_url and not data.order_id:
        raise HTTPException(status_code=400, detail="Pesan kosong")
    if data.image_url and not data.image_url.startswith("/api/files/"):
        raise HTTPException(status_code=400, detail="Gambar tidak valid")
    order_ref = None
    if data.order_id:
        o = await db.orders.find_one({"order_id": data.order_id, "user_id": conv_user["user_id"]}, {"_id": 0})
        if not o:
            raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
        order_ref = {"order_id": o["order_id"], "total": o["total"], "status": o["status"], "items": len(o["items"])}
    now = datetime.now(timezone.utc).isoformat()
    msg = {"message_id": f"msg_{uuid.uuid4().hex[:12]}", "conversation_id": conv_user["user_id"], "sender": sender,
           "text": data.text.strip(), "image_url": data.image_url, "order_ref": order_ref, "created_at": now}
    await db.messages.insert_one(dict(msg))
    preview = msg["text"] or ("[Foto]" if data.image_url else f"[Pesanan {data.order_id}]")
    inc = {"unread_admin": 1} if sender == "user" else {"unread_user": 1}
    await db.conversations.update_one({"conversation_id": conv_user["user_id"]}, {
        "$set": {"user_id": conv_user["user_id"], "user_name": conv_user["name"], "user_email": conv_user["email"],
                 "last_message": preview[:120], "last_sender": sender, "last_at": now}, "$inc": inc}, upsert=True)
    return msg

async def list_messages(conv_id: str, after: Optional[str]):
    q = {"conversation_id": conv_id}
    if after:
        q["created_at"] = {"$gt": after}
    return await db.messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)

@api_router.get("/chat/messages")
async def chat_messages(after: Optional[str] = None, user=Depends(get_current_user)):
    msgs = await list_messages(user["user_id"], after)
    await db.conversations.update_one({"conversation_id": user["user_id"]}, {"$set": {"unread_user": 0}})
    return msgs

@api_router.post("/chat/messages")
async def chat_send(data: ChatInput, user=Depends(get_current_user)):
    return await post_message(user, "user", data)

@api_router.get("/chat/unread")
async def chat_unread(user=Depends(get_current_user)):
    c = await db.conversations.find_one({"conversation_id": user["user_id"]}, {"_id": 0})
    return {"unread": (c or {}).get("unread_user", 0)}

@api_router.post("/chat/upload")
async def chat_upload(file: UploadFile = File(...), user=Depends(get_current_user)):
    return {"url": await store_image(file, "chat")}

@api_router.get("/admin/chat/conversations")
async def admin_conversations(user=Depends(require_admin)):
    return await db.conversations.find({}, {"_id": 0}).sort("last_at", -1).to_list(500)

@api_router.get("/admin/chat/{conv_id}/messages")
async def admin_chat_messages(conv_id: str, after: Optional[str] = None, user=Depends(require_admin)):
    msgs = await list_messages(conv_id, after)
    await db.conversations.update_one({"conversation_id": conv_id}, {"$set": {"unread_admin": 0}})
    return msgs

@api_router.post("/admin/chat/{conv_id}/messages")
async def admin_chat_send(conv_id: str, data: ChatInput, user=Depends(require_admin)):
    cu = await db.users.find_one({"user_id": conv_id}, {"_id": 0})
    if not cu:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    data.order_id = None
    return await post_message(cu, "admin", data)


# ---------------- Profit report (Laba Rugi) ----------------
REPORT_STATUSES = ["Diproses", "Dikirim", "Selesai"]

async def build_profit(start: str, end: str):
    s = datetime.fromisoformat(start).replace(tzinfo=WIB).astimezone(timezone.utc).isoformat()
    e = (datetime.fromisoformat(end).replace(tzinfo=WIB) + timedelta(days=1)).astimezone(timezone.utc).isoformat()
    orders = await db.orders.find({"status": {"$in": REPORT_STATUSES}, "created_at": {"$gte": s, "$lt": e}}, {"_id": 0}).sort("created_at", 1).to_list(10000)
    pids = {i["product_id"] for o in orders for i in o["items"] if "hpp" not in i}
    cur = {p["product_id"]: p.get("hpp", 0) for p in await db.products.find({"product_id": {"$in": list(pids)}}, {"_id": 0, "product_id": 1, "hpp": 1}).to_list(10000)}
    prods, rows = {}, []
    tot = {"sales": 0, "discount": 0, "hpp": 0, "shipping": 0, "orders": len(orders), "items_missing_hpp": 0}
    for o in orders:
        o_hpp, missing = 0, False
        for i in o["items"]:
            unit_hpp = i.get("hpp", cur.get(i["product_id"], 0)) or 0
            missing = missing or unit_hpp == 0
            line_hpp = unit_hpp * i["quantity"]
            o_hpp += line_hpp
            p = prods.setdefault(i["product_id"], {"product_id": i["product_id"], "name": i["name"], "qty": 0, "sales": 0, "hpp": 0, "missing_hpp": False})
            p["qty"] += i["quantity"]
            p["sales"] += i["price"] * i["quantity"]
            p["hpp"] += line_hpp
            p["missing_hpp"] = p["missing_hpp"] or unit_hpp == 0
        sub = o.get("subtotal") or sum(i["price"] * i["quantity"] for i in o["items"])
        disc = o.get("discount", 0)
        rows.append({"order_id": o["order_id"], "created_at": o["created_at"], "customer": o["user_name"], "status": o["status"],
                     "payment_method": o["payment_method"], "sales": sub, "discount": disc, "hpp": o_hpp,
                     "shipping": o.get("shipping_cost", 0), "profit": sub - disc - o_hpp, "missing_hpp": missing})
        tot["sales"] += sub
        tot["discount"] += disc
        tot["hpp"] += o_hpp
        tot["shipping"] += o.get("shipping_cost", 0)
    for p in prods.values():
        p["profit"] = p["sales"] - p["hpp"]
    tot["items_missing_hpp"] = sum(1 for p in prods.values() if p["missing_hpp"])
    tot["gross_profit"] = tot["sales"] - tot["discount"] - tot["hpp"]
    tot["margin"] = round(tot["gross_profit"] / tot["sales"] * 100, 1) if tot["sales"] else 0
    return {"start": start, "end": end, "summary": tot, "orders": rows,
            "products": sorted(prods.values(), key=lambda x: x["profit"], reverse=True)}

@api_router.get("/admin/reports/profit")
async def profit_report(start: str, end: str, user=Depends(require_admin)):
    try:
        return await build_profit(start, end)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format tanggal YYYY-MM-DD")

def xlsx_response(wb, filename: str):
    import io
    buf = io.BytesIO()
    wb.save(buf)
    return Response(content=buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})

@api_router.get("/admin/reports/profit.xlsx")
async def profit_report_xlsx(start: str, end: str, user=Depends(require_admin)):
    from openpyxl import Workbook
    r = await build_profit(start, end)
    wb = Workbook()
    ws = wb.active
    ws.title = "Ringkasan"
    s = r["summary"]
    for row in [[f"Laporan Laba Rugi Pesanan Web {STORE_NAME}"], ["Periode", f"{start} s/d {end}"], [],
                ["Jumlah pesanan", s["orders"]], ["Penjualan", s["sales"]], ["Diskon voucher", s["discount"]],
                ["HPP", s["hpp"]], ["Laba kotor", s["gross_profit"]], ["Margin %", s["margin"]],
                ["Ongkir (tidak dihitung laba)", s["shipping"]], ["Produk tanpa HPP", s["items_missing_hpp"]]]:
        ws.append(row)
    wp = wb.create_sheet("Per Produk")
    wp.append(["ID Produk", "Nama", "Qty", "Penjualan", "HPP", "Laba", "HPP belum diisi"])
    for p in r["products"]:
        wp.append([p["product_id"], p["name"], p["qty"], p["sales"], p["hpp"], p["profit"], "Ya" if p["missing_hpp"] else ""])
    wo = wb.create_sheet("Per Pesanan")
    wo.append(["No. Pesanan", "Tanggal", "Pelanggan", "Status", "Bayar", "Penjualan", "Diskon", "HPP", "Laba", "Ongkir", "HPP belum diisi"])
    for o in r["orders"]:
        wo.append([o["order_id"], o["created_at"][:16].replace("T", " "), o["customer"], o["status"], o["payment_method"].upper(),
                   o["sales"], o["discount"], o["hpp"], o["profit"], o["shipping"], "Ya" if o["missing_hpp"] else ""])
    return xlsx_response(wb, f"laba-rugi_{start}_{end}.xlsx")

@api_router.get("/admin/products/hpp-template.xlsx")
async def hpp_template(user=Depends(require_admin)):
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "HPP"
    ws.append(["product_id", "variant_id", "nama_produk", "varian", "harga_jual", "hpp", "harga_toko"])
    proj = {"_id": 0, "product_id": 1, "name": 1, "price": 1, "hpp": 1, "store_price": 1, "variants": 1}
    for p in await db.products.find({"archived": {"$ne": True}}, proj).sort("name", 1).to_list(5000):
        if p.get("variants"):
            for v in p["variants"]:
                ws.append([p["product_id"], v["variant_id"], p["name"], v.get("name", ""), v.get("price", 0), v.get("hpp", 0), v.get("store_price", 0)])
        else:
            ws.append([p["product_id"], "", p["name"], "", p["price"], p.get("hpp", 0), p.get("store_price", 0)])
    return xlsx_response(wb, "template-hpp.xlsx")

class VariantPricePatch(BaseModel):
    price: Optional[int] = Field(default=None, gt=0)
    hpp: Optional[int] = Field(default=None, ge=0)
    store_price: Optional[int] = Field(default=None, ge=0)

@api_router.patch("/admin/products/{product_id}/variants/{variant_id}")
async def admin_patch_variant(product_id: str, variant_id: str, data: VariantPricePatch, user=Depends(require_admin)):
    if not await _apply_price_row(product_id, variant_id, data.price, data.hpp, data.store_price):
        raise HTTPException(status_code=404, detail="Varian tidak ditemukan")
    return {"ok": True}

def _parse_rupiah(val) -> Optional[int]:
    val = str(val).strip()
    if _re.fullmatch(r"\d+(\.\d+)?", val) and not _re.fullmatch(r"\d{1,3}(\.\d{3})+", val):
        return int(float(val))
    val = val.replace(".", "").replace(",", "").replace("Rp", "").strip()
    return int(val) if val.isdigit() else None

async def _apply_price_row(pid: str, vid: str, price: Optional[int], hpp: Optional[int], store_price: Optional[int] = None) -> bool:
    p = await db.products.find_one({"product_id": pid}, {"_id": 0, "variants": 1, "price": 1, "discount": 1})
    if not p:
        return False
    upd = {}
    if vid:
        vs = p.get("variants") or []
        if not any(x["variant_id"] == vid for x in vs):
            return False
        vset = {**({"variants.$.price": price} if price is not None else {}), **({"variants.$.hpp": hpp} if hpp is not None else {}),
                **({"variants.$.store_price": store_price} if store_price is not None else {})}
        if vset:
            await db.products.update_one({"product_id": pid, "variants.variant_id": vid}, {"$set": vset})
        if price is None:
            return True
        fresh = await db.products.find_one({"product_id": pid}, {"_id": 0, "variants.price": 1})
        upd = {"price": min(x.get("price", 0) for x in fresh["variants"])}
    else:
        if price is not None:
            upd["price"] = price
        if hpp is not None:
            upd["hpp"] = hpp
        if store_price is not None:
            upd["store_price"] = store_price
    if not upd:
        return True
    if "price" in upd:
        disc = p.get("discount", 0)
        upd["final_price"] = round(upd["price"] * (1 - disc / 100)) if disc else upd["price"]
    await db.products.update_one({"product_id": pid}, {"$set": upd})
    return True

@api_router.post("/admin/products/hpp-import")
async def hpp_import(file: UploadFile = File(...), user=Depends(require_admin)):
    import io
    import pandas as pd
    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw), dtype=str) if file.filename.lower().endswith(".csv") else pd.read_excel(io.BytesIO(raw), dtype=str, engine="calamine")
    except Exception:
        raise HTTPException(status_code=400, detail="File tidak bisa dibaca (gunakan .xlsx atau .csv)")
    df.columns = [str(c).strip().lower() for c in df.columns]
    if "product_id" not in df.columns or not ({"hpp", "harga_jual", "harga_toko"} & set(df.columns)):
        raise HTTPException(status_code=400, detail="Kolom wajib: product_id serta hpp, harga_jual, dan/atau harga_toko")
    updated, skipped = 0, 0
    for _, row in df.fillna("").iterrows():
        pid = str(row["product_id"]).strip().split(".")[0]
        vid = str(row.get("variant_id", "")).strip()
        hpp = _parse_rupiah(row["hpp"]) if "hpp" in df.columns and str(row["hpp"]).strip() else None
        price = _parse_rupiah(row["harga_jual"]) if "harga_jual" in df.columns and str(row["harga_jual"]).strip() else None
        store = _parse_rupiah(row["harga_toko"]) if "harga_toko" in df.columns and str(row["harga_toko"]).strip() else None
        if price is not None and price <= 0:
            price = None
        if not pid or (hpp is None and price is None and store is None) or not await _apply_price_row(pid, vid, price, hpp, store):
            skipped += 1
            continue
        updated += 1
    return {"updated": updated, "skipped": skipped}


# ---------------- HPP-zero archive, restock alerts, curated promos ----------------
def _hpp_zero(p: dict) -> bool:
    vs = p.get("variants") or []
    return not any(v.get("hpp") for v in vs) if vs else not p.get("hpp")

@api_router.get("/admin/products/hpp-zero")
async def admin_hpp_zero(user=Depends(require_admin)):
    proj = {"_id": 0, "product_id": 1, "name": 1, "image": 1, "price": 1, "stock": 1, "category_name": 1, "hpp": 1, "variants": 1}
    out = []
    for p in await db.products.find({"archived": {"$ne": True}}, proj).sort("name", 1).to_list(5000):
        if _hpp_zero(p):
            out.append({"product_id": p["product_id"], "name": p["name"], "image": p.get("image", ""), "price": p.get("price", 0),
                        "stock": p.get("stock", 0), "category_name": p.get("category_name", ""), "variant_count": len(p.get("variants") or [])})
    return out

class ProductIds(BaseModel):
    product_ids: List[str] = Field(min_length=1, max_length=5000)

@api_router.post("/admin/products/archive-hpp-zero")
async def admin_archive_hpp_zero(data: ProductIds, user=Depends(require_admin)):
    docs = await db.products.find({"product_id": {"$in": data.product_ids}, "archived": {"$ne": True}},
                                  {"_id": 0, "product_id": 1, "hpp": 1, "variants": 1}).to_list(5000)
    ids = [p["product_id"] for p in docs if _hpp_zero(p)]
    if ids:
        await db.products.update_many({"product_id": {"$in": ids}}, {"$set": {"archived": True, "active": False}})
    return {"archived": len(ids)}

class RestockInput(BaseModel):
    email: EmailStr
    product_id: str = Field(min_length=1, max_length=40)
    variant_id: Optional[str] = Field(default=None, max_length=40)

def _in_stock(p: dict, vid: Optional[str]) -> bool:
    if vid:
        v = next((x for x in p.get("variants") or [] if x["variant_id"] == vid), None)
        return bool(v and v.get("stock", 0) > 0)
    return p.get("stock", 0) > 0

def _store_origin(origin: str) -> str:
    allowed = [o.strip() for o in os.environ["CORS_ORIGINS"].split(",") if o.strip()]
    ok = origin.startswith("https://") and (origin in allowed or _re.fullmatch(os.environ["CORS_ORIGIN_REGEX"], origin))
    return origin if ok else ""

@api_router.post("/restock-alerts")
async def restock_subscribe(data: RestockInput, request: Request):
    p = await db.products.find_one({"product_id": data.product_id, "active": True, "archived": {"$ne": True}}, {"_id": 0, "variants": 1, "stock": 1})
    if not p:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    vid = data.variant_id if p.get("variants") else None
    if p.get("variants") and not any(v["variant_id"] == vid for v in p["variants"]):
        raise HTTPException(status_code=400, detail="Pilih varian produk")
    if _in_stock(p, vid):
        raise HTTPException(status_code=400, detail="Produk ini masih tersedia, silakan langsung dibeli")
    email = data.email.lower()
    if await db.restock_alerts.count_documents({"email": email, "notified_at": None}) >= 20:
        raise HTTPException(status_code=429, detail="Terlalu banyak permintaan notifikasi untuk email ini")
    await db.restock_alerts.update_one(
        {"email": email, "product_id": data.product_id, "variant_id": vid, "notified_at": None},
        {"$setOnInsert": {"alert_id": f"ra_{uuid.uuid4().hex[:12]}", "created_at": now_iso(),
                          "origin": _store_origin(request.headers.get("origin", ""))}}, upsert=True)
    return {"ok": True}

async def notify_restock(pid: str):
    try:
        p = await db.products.find_one({"product_id": pid, "active": True, "archived": {"$ne": True}}, {"_id": 0})
        if not p:
            return
        for a in await db.restock_alerts.find({"product_id": pid, "notified_at": None}, {"_id": 0}).to_list(1000):
            if not _in_stock(p, a.get("variant_id")):
                continue
            claim = await db.restock_alerts.update_one({"alert_id": a["alert_id"], "notified_at": None}, {"$set": {"notified_at": now_iso()}})
            if not claim.modified_count:
                continue
            vname = next((v["name"] for v in p.get("variants") or [] if v["variant_id"] == a.get("variant_id")), "")
            title = f'{p["name"]}{f" ({vname})" if vname else ""}'
            link = (f'<p><a href="{a["origin"]}/?p={p["product_id"]}" style="background:#059669;color:#fff;padding:10px 18px;'
                    f'border-radius:8px;text-decoration:none;display:inline-block">Belanja sekarang</a></p>') if a.get("origin") else ""
            html = (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#0f172a">'
                    f'<p>Halo,</p><p>Kabar baik! <b>{_esc(title)}</b> sudah tersedia lagi di {_esc(EMAIL_FROM_NAME)}.</p>'
                    f'<p>Stok terbatas, segera pesan sebelum kehabisan.</p>{link}'
                    f'<p style="font-size:12px;color:#888">Anda menerima email ini karena menekan "Kabari saya" pada produk tersebut.</p>'
                    f'</td></tr></table>')
            try:
                await send_email(to=a["email"], subject=f"{p['name'][:60]} sudah tersedia lagi", html=html)
            except Exception as e:
                logger.warning(f"Restock email failed {a['alert_id']}: {e}")
                await db.restock_alerts.update_one({"alert_id": a["alert_id"]}, {"$set": {"notified_at": None}})
    except Exception:
        logger.exception("notify_restock failed")

def schedule_restock(pids) -> None:
    for pid in set(pids):
        t = asyncio.create_task(notify_restock(pid))
        _bg_tasks.add(t)
        t.add_done_callback(_bg_tasks.discard)

class PromoInput(BaseModel):
    section: str = Field(pattern=r"^(best|pick)$")
    product_id: str = Field(min_length=1, max_length=40)
    variant_id: Optional[str] = Field(default=None, max_length=40)
    promo_price: int = Field(gt=0)
    start_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")

async def _promo_view(x: dict) -> Optional[dict]:
    fv = await _flash_view({**x, "quota": 0, "sold": 0})
    if not fv:
        return None
    for k in ("remaining", "quota", "sold"):
        fv.pop(k, None)
    t = wib_today()
    fv["status"] = "active" if x["start_date"] <= t <= x["end_date"] else ("scheduled" if x["start_date"] > t else "ended")
    return fv

async def _check_promo(data: PromoInput, exclude: str = "") -> None:
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="Tanggal selesai harus setelah tanggal mulai")
    if data.end_date < wib_today():
        raise HTTPException(status_code=400, detail="Tanggal selesai sudah lewat")
    p = await db.products.find_one({"product_id": data.product_id}, {"_id": 0, "variants": 1})
    if not p:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    if p.get("variants") and not any(v["variant_id"] == data.variant_id for v in p["variants"]):
        raise HTTPException(status_code=400, detail="Pilih varian produk")
    if not p.get("variants"):
        data.variant_id = None
    fv = await _promo_view(data.model_dump())
    if data.promo_price >= fv["normal_price"]:
        raise HTTPException(status_code=400, detail=f"Harga promo harus di bawah harga normal ({fv['normal_price']})")
    dup = await db.promo_items.find_one({"section": data.section, "product_id": data.product_id, "variant_id": data.variant_id,
                                         "promo_id": {"$ne": exclude}, "start_date": {"$lte": data.end_date}, "end_date": {"$gte": data.start_date}})
    if dup:
        raise HTTPException(status_code=400, detail="Produk/varian ini sudah punya promo di rentang tanggal tersebut")

@api_router.get("/admin/promos")
async def admin_promo_list(section: str, user=Depends(require_admin)):
    out = []
    for x in await db.promo_items.find({"section": section}, {"_id": 0}).sort("start_date", -1).to_list(500):
        v = await _promo_view(x)
        if v:
            out.append(v)
    return out

@api_router.post("/admin/promos")
async def admin_promo_create(data: PromoInput, user=Depends(require_admin)):
    await _check_promo(data)
    doc = {**data.model_dump(), "promo_id": f"pr_{uuid.uuid4().hex[:10]}", "created_at": now_iso()}
    await db.promo_items.insert_one(dict(doc))
    return await _promo_view(doc)

@api_router.put("/admin/promos/{promo_id}")
async def admin_promo_update(promo_id: str, data: PromoInput, user=Depends(require_admin)):
    if not await db.promo_items.find_one({"promo_id": promo_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Promo tidak ditemukan")
    await _check_promo(data, exclude=promo_id)
    await db.promo_items.update_one({"promo_id": promo_id}, {"$set": data.model_dump()})
    return await _promo_view(await db.promo_items.find_one({"promo_id": promo_id}, {"_id": 0}))

@api_router.delete("/admin/promos/{promo_id}")
async def admin_promo_delete(promo_id: str, user=Depends(require_admin)):
    if not (await db.promo_items.delete_one({"promo_id": promo_id})).deleted_count:
        raise HTTPException(status_code=404, detail="Promo tidak ditemukan")
    return {"ok": True}

async def _active_promo_docs(section: Optional[str] = None) -> list:
    t = wib_today()
    q = {"start_date": {"$lte": t}, "end_date": {"$gte": t}, **({"section": section} if section else {})}
    return await db.promo_items.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)

@api_router.get("/promos")
async def public_promos(section: Optional[str] = None):
    out = []
    for x in await _active_promo_docs(section):
        v = await _promo_view(x)
        if v and v["product"].get("active", True) and not v["product"].get("archived") and _in_stock(v["product"], x.get("variant_id")) \
                and x["promo_price"] < v["normal_price"]:
            out.append(v)
    return out


# ---------------- Wallet, cancel, complaints, cart, customers ----------------
class TopupInput(BaseModel):
    amount: int = Field(ge=10000, le=10_000_000)
    method: str

class WalletAdjust(BaseModel):
    amount: int
    note: str = Field(default="", max_length=200)

class CancelInput(BaseModel):
    reason: str = Field(default="", max_length=300)

class CancelDecision(BaseModel):
    approve: bool
    note: str = Field(default="", max_length=300)

class ComplaintInput(BaseModel):
    order_id: str
    reason: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1500)
    items: List[str] = []
    photos: List[str] = Field(default=[], max_length=5)

class ComplaintResolve(BaseModel):
    status: str
    refund_amount: int = Field(default=0, ge=0)
    admin_note: str = Field(default="", max_length=500)

class CartSync(BaseModel):
    items: List[dict] = Field(default=[], max_length=100)

class CategoryImage(BaseModel):
    image: str = Field(min_length=1)

def now_iso():
    return datetime.now(timezone.utc).isoformat()

async def wallet_tx(user_id, amount, kind, ref, note):
    await db.wallet_tx.insert_one({"tx_id": f"tx_{uuid.uuid4().hex[:12]}", "user_id": user_id, "amount": amount,
                                   "type": kind, "ref": ref, "note": note, "created_at": now_iso()})

async def wallet_credit(user_id, amount, kind, ref, note):
    await db.users.update_one({"user_id": user_id}, {"$inc": {"balance": amount}})
    await wallet_tx(user_id, amount, kind, ref, note)

async def wallet_debit(user_id, amount, kind, ref, note) -> bool:
    r = await db.users.update_one({"user_id": user_id, "balance": {"$gte": amount}}, {"$inc": {"balance": -amount}})
    if r.modified_count:
        await wallet_tx(user_id, -amount, kind, ref, note)
    return bool(r.modified_count)

async def reserve_stock(items) -> bool:
    done = []
    for it in items:
        q = it["quantity"]
        if it.get("variant_id"):
            r = await db.products.update_one(
                {"product_id": it["product_id"], "variants": {"$elemMatch": {"variant_id": it["variant_id"], "stock": {"$gte": q}}}},
                {"$inc": {"variants.$.stock": -q, "stock": -q}})
        else:
            r = await db.products.update_one({"product_id": it["product_id"], "stock": {"$gte": q}}, {"$inc": {"stock": -q}})
        if not r.modified_count:
            await adjust_stock(done, 1)
            return False
        done.append(it)
    return True

async def adjust_stock(items, sign):
    for it in items:
        q = sign * it["quantity"]
        if it.get("variant_id"):
            await db.products.update_one({"product_id": it["product_id"], "variants.variant_id": it["variant_id"]},
                                         {"$inc": {"variants.$.stock": q, "stock": q}})
        else:
            await db.products.update_one({"product_id": it["product_id"]}, {"$inc": {"stock": q}})
    if sign > 0:
        schedule_restock([it["product_id"] for it in items])

async def apply_topup_status(tid: str, body: dict):
    st, fraud = body.get("transaction_status"), body.get("fraud_status", "accept")
    if st in ("settlement", "capture") and fraud == "accept":
        r = await db.topups.update_one({"topup_id": tid, "status": "pending"}, {"$set": {"status": "paid", "paid_at": now_iso()}})
        if r.modified_count:
            t = await db.topups.find_one({"topup_id": tid}, {"_id": 0})
            await wallet_credit(t["user_id"], t["amount"], "topup", tid, "Top up saldo")
    elif st in ("expire", "cancel", "deny"):
        await db.topups.update_one({"topup_id": tid, "status": "pending"}, {"$set": {"status": "failed"}})

@api_router.get("/wallet")
async def my_wallet(user=Depends(get_current_user)):
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "balance": 1})
    txs = await db.wallet_tx.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    tops = await db.topups.find({"user_id": user["user_id"], "status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(10)
    return {"balance": (u or {}).get("balance", 0), "transactions": txs, "pending_topups": tops}

@api_router.post("/wallet/topup")
async def wallet_topup(data: TopupInput, user=Depends(get_current_user)):
    if data.method not in MIDTRANS_CHANNELS:
        raise HTTPException(status_code=400, detail="Metode top up tidak didukung")
    tid = f"TOP{datetime.now().strftime('%y%m%d')}{uuid.uuid4().hex[:6].upper()}"
    snap = await asyncio.to_thread(midtrans_create, {"order_id": tid, "total": data.amount, "payment_method": data.method, "user_email": user["email"],
                            "address": {"name": user["name"], "phone": user.get("phone") or ""}})
    doc = {"topup_id": tid, "user_id": user["user_id"], "amount": data.amount, "method": data.method, "status": "pending",
           "snap_token": snap["token"], "created_at": now_iso()}
    await db.topups.insert_one(dict(doc))
    return clean(doc)

@api_router.get("/wallet/topup/{tid}/status")
async def wallet_topup_status(tid: str, user=Depends(get_current_user)):
    t = await db.topups.find_one({"topup_id": tid, "user_id": user["user_id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Top up tidak ditemukan")
    if t["status"] == "pending":
        r = requests.get(f"{CORE_BASE}/v2/{tid}/status", auth=(MIDTRANS_SERVER_KEY, ""), timeout=20)
        body = r.json() if r.ok else {}
        if body.get("transaction_status") and int(float(body.get("gross_amount", 0))) == t["amount"]:
            await apply_topup_status(tid, body)
    return await db.topups.find_one({"topup_id": tid}, {"_id": 0})

@api_router.post("/admin/customers/{user_id}/wallet")
async def admin_wallet_adjust(user_id: str, data: WalletAdjust, user=Depends(require_admin)):
    if data.amount == 0:
        raise HTTPException(status_code=400, detail="Jumlah tidak boleh 0")
    note = data.note or "Penyesuaian admin"
    if data.amount > 0:
        await wallet_credit(user_id, data.amount, "admin_adjust", user["user_id"], note)
    elif not await wallet_debit(user_id, -data.amount, "admin_adjust", user["user_id"], note):
        raise HTTPException(status_code=400, detail="Saldo konsumen tidak cukup")
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "balance": 1})
    return {"balance": u.get("balance", 0)}

@api_router.get("/admin/customers")
async def admin_customers(user=Depends(require_admin)):
    stats = {s["_id"]: s for s in await db.orders.aggregate([
        {"$group": {"_id": "$user_id", "orders": {"$sum": 1}, "last": {"$max": "$created_at"},
                    "spend": {"$sum": {"$cond": [{"$in": ["$status", REPORT_STATUSES]}, "$total", 0]}}}}]).to_list(10000)}
    out = []
    for u in await db.users.find({"role": {"$ne": "admin"}}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(10000):
        s = stats.get(u["user_id"], {})
        out.append({**u, "balance": u.get("balance", 0), "orders": s.get("orders", 0), "spend": s.get("spend", 0),
                    "last_order_at": s.get("last")})
    return out

@api_router.get("/admin/customers/{user_id}/wallet")
async def admin_customer_wallet(user_id: str, user=Depends(require_admin)):
    return await db.wallet_tx.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)

async def cancel_order_now(o: dict, by: str, reason: str):
    r = await db.orders.update_one({"order_id": o["order_id"], "status": {"$nin": ["Dibatalkan", "Selesai"]}},
                                   {"$set": {"status": "Dibatalkan", "cancelled_by": by, "cancel_reason": reason, "cancelled_at": now_iso()}})
    if not r.modified_count:
        raise HTTPException(status_code=400, detail="Pesanan tidak bisa dibatalkan")
    await adjust_stock(o["items"], 1)
    await release_flash(o["items"])
    await db.orders.update_one({"order_id": o["order_id"], "affiliate.status": "pending"}, {"$set": {"affiliate.status": "cancelled"}})
    if o["payment_method"] == "saldo" or o.get("paid_at"):
        if o["payment_method"] == "saldo":
            await wallet_credit(o["user_id"], o["total"], "refund", o["order_id"], f"Refund pembatalan {o['order_id']}")
        else:
            await refund_customer(o["user_id"], o["total"], o["order_id"], f"Refund pembatalan {o['order_id']}")
    elif o["payment_method"] in MIDTRANS_CHANNELS:
        try:
            requests.post(f"{CORE_BASE}/v2/{o['order_id']}/cancel", auth=(MIDTRANS_SERVER_KEY, ""), timeout=10)
        except requests.RequestException:
            pass

@api_router.post("/orders/{order_id}/cancel")
async def customer_cancel(order_id: str, data: CancelInput, user=Depends(get_current_user)):
    o = await db.orders.find_one({"order_id": order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if o["status"] not in ("Menunggu Pembayaran", "Diproses") or (o.get("shipment") or {}).get("status") in ACTIVE_SHIPMENT:
        raise HTTPException(status_code=400, detail="Pesanan sudah diproses kurir, tidak bisa dibatalkan")
    age = datetime.now(timezone.utc) - datetime.fromisoformat(o["created_at"])
    if age <= timedelta(minutes=10):
        await cancel_order_now(o, "customer", data.reason)
    else:
        if (o.get("cancel_request") or {}).get("status") == "pending":
            raise HTTPException(status_code=400, detail="Pengajuan pembatalan sedang ditinjau admin")
        await db.orders.update_one({"order_id": order_id}, {"$set": {"cancel_request": {"status": "pending", "reason": data.reason, "at": now_iso()}}})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})

@api_router.post("/admin/orders/{order_id}/cancel-request")
async def admin_cancel_decision(order_id: str, data: CancelDecision, user=Depends(require_admin)):
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o or (o.get("cancel_request") or {}).get("status") != "pending":
        raise HTTPException(status_code=400, detail="Tidak ada pengajuan pembatalan")
    if data.approve:
        await cancel_order_now(o, "admin", o["cancel_request"].get("reason", ""))
    await db.orders.update_one({"order_id": order_id}, {"$set": {"cancel_request.status": "approved" if data.approve else "rejected",
                                                                   "cancel_request.note": data.note, "cancel_request.decided_at": now_iso()}})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})

@api_router.post("/complaints")
async def create_complaint(data: ComplaintInput, user=Depends(get_current_user)):
    o = await db.orders.find_one({"order_id": data.order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if o["status"] not in ("Dikirim", "Selesai"):
        raise HTTPException(status_code=400, detail="Komplain hanya untuk pesanan yang sudah dikirim/selesai")
    if any(not p.startswith("/api/files/") for p in data.photos):
        raise HTTPException(status_code=400, detail="Foto tidak valid")
    doc = {"complaint_id": f"CMP{uuid.uuid4().hex[:8].upper()}", "user_id": user["user_id"], "user_name": user["name"],
           **data.model_dump(), "order_total": o["total"], "status": "open", "refund_amount": 0, "admin_note": "", "created_at": now_iso()}
    await db.complaints.insert_one(dict(doc))
    return clean(doc)

@api_router.get("/complaints")
async def my_complaints(user=Depends(get_current_user)):
    return await db.complaints.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)

@api_router.get("/admin/complaints")
async def admin_complaints(user=Depends(require_admin)):
    return await db.complaints.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.post("/admin/complaints/{cid}/resolve")
async def admin_resolve_complaint(cid: str, data: ComplaintResolve, user=Depends(require_admin)):
    if data.status not in ("resolved", "rejected"):
        raise HTTPException(status_code=400, detail="Status tidak valid")
    c = await db.complaints.find_one({"complaint_id": cid}, {"_id": 0})
    if not c or c["status"] != "open":
        raise HTTPException(status_code=400, detail="Komplain sudah diproses")
    refund = data.refund_amount if data.status == "resolved" else 0
    if refund:
        prior = sum(x.get("refund_amount", 0) for x in await db.complaints.find({"order_id": c["order_id"]}, {"_id": 0}).to_list(100))
        if refund > c["order_total"] - prior:
            raise HTTPException(status_code=400, detail="Refund melebihi total pesanan")
    r = await db.complaints.update_one({"complaint_id": cid, "status": "open"}, {"$set": {
        "status": data.status, "refund_amount": refund, "admin_note": data.admin_note, "resolved_at": now_iso()}})
    if r.modified_count and refund:
        await refund_customer(c["user_id"], refund, c["order_id"], f"Refund komplain {cid}")
    return await db.complaints.find_one({"complaint_id": cid}, {"_id": 0})

@api_router.put("/cart")
async def sync_cart(data: CartSync, user=Depends(get_current_user)):
    if not data.items:
        await db.carts.delete_one({"user_id": user["user_id"]})
    else:
        await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": data.items, "updated_at": now_iso(), "reminded": False}}, upsert=True)
    return {"ok": True}

async def run_cart_reminders(base_url: str):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    for c in await db.carts.find({"updated_at": {"$lte": cutoff}, "reminded": False}, {"_id": 0}).to_list(500):
        await db.carts.update_one({"user_id": c["user_id"]}, {"$set": {"reminded": True}})
        u = await db.users.find_one({"user_id": c["user_id"], "phone_verified": True}, {"_id": 0})
        if not u:
            continue
        names = ", ".join(str(i.get("name", ""))[:30] for i in c["items"][:3])
        text = f"Keranjang belanja Anda masih menunggu: {names}. Yuk selesaikan pesanan sebelum stok habis: {base_url}/"
        try:
            await asyncio.to_thread(_send_wa, u["phone"], u["name"], "Keranjang", text)
        except Exception as e:
            logger.error(f"Cart reminder {u['user_id']} failed: {e}")

def _cron_auth(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], os.environ["WEBHOOK_CRON_SECRET"]):
        raise HTTPException(status_code=401, detail="Unauthorized")

async def _cron_once(request: Request, job: str) -> bool:
    try:
        body = await request.json()
    except Exception:
        body = {}
    run_id = f"{job}:{request.headers.get('X-Webhook-Id') or body.get('run_id') or uuid.uuid4().hex}"
    if await db.cron_runs.find_one({"run_id": run_id}):
        return False
    await db.cron_runs.insert_one({"run_id": run_id, "job": job, "at": now_iso()})
    return True

async def mark_completed(order_id: str):
    await db.orders.update_one({"order_id": order_id, "completed_at": {"$exists": False}}, {"$set": {"completed_at": now_iso()}})
    o = await db.orders.find_one_and_update({"order_id": order_id, "affiliate.status": "pending"},
                                            {"$set": {"affiliate.status": "paid", "affiliate.paid_at": now_iso()}})
    if o:
        a = o["affiliate"]
        await commission_credit(a["user_id"], a["amount"], "affiliate", order_id, f"Komisi affiliate pesanan {order_id}")

async def run_review_reminders(base_url: str):
    now = datetime.now(timezone.utc)
    q = {"status": "Selesai", "review_reminded": {"$ne": True},
         "completed_at": {"$lte": (now - timedelta(hours=24)).isoformat(), "$gte": (now - timedelta(days=7)).isoformat()}}
    for o in await db.orders.find(q, {"_id": 0}).to_list(500):
        r = await db.orders.update_one({"order_id": o["order_id"], "review_reminded": {"$ne": True}}, {"$set": {"review_reminded": True}})
        if not r.modified_count:
            continue
        u = await db.users.find_one({"user_id": o["user_id"], "phone_verified": True}, {"_id": 0})
        reviewed = {x["product_id"] for x in await db.reviews.find({"order_id": o["order_id"]}, {"_id": 0, "product_id": 1}).to_list(100)}
        if not u or all(i["product_id"] in reviewed for i in o["items"]):
            continue
        text = (f"Halo {u['name']}, terima kasih sudah belanja di {STORE_NAME}! Bagaimana kualitas pesanan {o['order_id']}? "
                f"Beri ulasan bintang & foto di sini: {base_url}/orders")
        entry = {"event": "review_reminder", "at": now_iso()}
        try:
            entry["sid"] = await asyncio.to_thread(_send_wa, u["phone"], u["name"], o["order_id"], text)
            entry["status"] = "sent"
        except Exception as e:
            entry.update(status="failed", error=str(getattr(e, "msg", e))[:200])
            logger.error(f"Review reminder {o['order_id']} failed: {e}")
        await db.orders.update_one({"order_id": o["order_id"]}, {"$push": {"notifications": entry}})

@api_router.post("/cron/review-reminders")
async def cron_review_reminders(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    _cron_auth(request)
    if not await _cron_once(request, "review-reminders"):
        return {"ok": True, "duplicate": True}
    run_bg(run_review_reminders(public_base(request)))
    return {"ok": True}

@api_router.post("/cron/abandoned-carts")
async def cron_abandoned_carts(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    _cron_auth(request)
    if not await _cron_once(request, "abandoned-carts"):
        return {"ok": True, "duplicate": True}
    run_bg(run_cart_reminders(public_base(request)))
    return {"ok": True}

def public_base(request: Request) -> str:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    return f"https://{host}"


class FlashWaSettings(BaseModel):
    enabled: bool = True
    audience: str = Field(default="loyal", pattern="^(loyal|buyers)$")

async def _flash_wa_settings() -> dict:
    s = await db.settings.find_one({"key": "flash_wa"}, {"_id": 0}) or {}
    return {"enabled": s.get("enabled", True), "audience": s.get("audience", "loyal")}

async def _flash_wa_recipients(audience: str) -> list:
    match = {"status": "Selesai"} if audience == "loyal" else {"status": {"$nin": ["Dibatalkan", "Menunggu Pembayaran"]}}
    if audience == "loyal":
        match["created_at"] = {"$gte": (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()}
    need = 2 if audience == "loyal" else 1
    agg = await db.orders.aggregate([{"$match": match}, {"$group": {"_id": "$user_id", "n": {"$sum": 1}}},
                                     {"$match": {"n": {"$gte": need}}}]).to_list(10000)
    ids = [a["_id"] for a in agg]
    return await db.users.find({"user_id": {"$in": ids}, "phone_verified": True, "role": {"$ne": "admin"}},
                               {"_id": 0, "user_id": 1, "name": 1, "phone": 1}).to_list(10000)

@api_router.get("/admin/flash-wa-settings")
async def admin_flash_wa_get(user=Depends(require_admin)):
    s = await _flash_wa_settings()
    last = await db.flash_wa_runs.find_one({}, {"_id": 0}, sort=[("date", -1)])
    return {**s, "recipients": len(await _flash_wa_recipients(s["audience"])), "last_run": last}

@api_router.put("/admin/flash-wa-settings")
async def admin_flash_wa_put(data: FlashWaSettings, user=Depends(require_admin)):
    await db.settings.update_one({"key": "flash_wa"}, {"$set": {"key": "flash_wa", **data.model_dump()}}, upsert=True)
    return await admin_flash_wa_get(user)

async def run_flash_wa(base_url: str):
    s = await _flash_wa_settings()
    today = wib_today()
    if not s["enabled"]:
        return
    items = [f for f in await flash_sale_today() if f["remaining"] > 0]
    if not items:
        return
    try:
        await db.flash_wa_runs.insert_one({"date": today, "at": now_iso(), "sent": 0, "failed": 0, "status": "running"})
    except DuplicateKeyError:
        return
    top = "; ".join(f"{f['product']['name'][:30]} Rp{f['flash_price']:,}".replace(",", ".") for f in items[:3])
    text = (f"FLASH SALE hari ini di {STORE_NAME}! {top}{' dan lainnya' if len(items) > 3 else ''}. "
            f"Berlaku s.d. 23:59 WIB, kuota terbatas: {base_url}/#flash-sale")
    sent = failed = 0
    err = ""
    for u in await _flash_wa_recipients(s["audience"]):
        try:
            await asyncio.to_thread(_send_wa, u["phone"], u["name"], "Flash Sale", text)
            sent += 1
        except Exception as e:
            failed += 1
            err = str(getattr(e, "msg", e))[:200]
            logger.error(f"Flash WA {u['user_id']} failed: {e}")
    await db.flash_wa_runs.update_one({"date": today}, {"$set": {"sent": sent, "failed": failed, "error": err,
                                                                 "status": "failed" if failed and not sent else "done"}})

@api_router.post("/cron/flash-sale-wa")
async def cron_flash_sale_wa(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    _cron_auth(request)
    if not await _cron_once(request, "flash-sale-wa"):
        return {"ok": True, "duplicate": True}
    run_bg(run_flash_wa(public_base(request)))
    return {"ok": True}

def _order_line(o: dict) -> str:
    s = o.get("shipment") or {}
    track = f"\nLacak: {s['tracking_link']}" if s.get("tracking_link") else ""
    return f"*{o['order_id']}* · {o['status']} · Rp{o['total']:,}".replace(",", ".") + track

async def wa_bot_reply(phone: str, text: str, base: str) -> str:
    u = await db.users.find_one({"phone": phone, "phone_verified": True}, {"_id": 0})
    if not u:
        return f"Nomor ini belum terhubung ke akun {STORE_NAME}. Daftar/masuk & verifikasi WhatsApp di {base}/login"
    limit = 3 if text.strip().lower().startswith("pesanan") else 1
    orders = await db.orders.find({"user_id": u["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    if not orders:
        return f"Halo {u['name']}, Anda belum punya pesanan. Belanja di {base}/"
    head = "3 pesanan terakhir Anda:" if limit == 3 else "Pesanan terakhir Anda:"
    body = "\n\n".join(_order_line(o) for o in orders)
    return f"Halo {u['name']}, {head}\n{body}\n\nDetail: {base}/orders\nKetik *pesanan* untuk 3 pesanan terakhir, *status* untuk pesanan terakhir."

@api_router.post("/webhooks/twilio/whatsapp")
async def twilio_whatsapp_inbound(request: Request):
    from twilio.request_validator import RequestValidator
    from twilio.twiml.messaging_response import MessagingResponse
    form = dict(await request.form())
    base = public_base(request)
    url = f"{base}{request.url.path}"
    if not RequestValidator(os.environ["TWILIO_AUTH_TOKEN"]).validate(url, form, request.headers.get("X-Twilio-Signature", "")):
        raise HTTPException(status_code=403, detail="Invalid signature")
    sender = str(form.get("From", "")).replace("whatsapp:", "")
    try:
        reply = await wa_bot_reply(normalize_phone(sender), str(form.get("Body", "")), base)
    except HTTPException:
        reply = "Nomor tidak dikenali."
    tw = MessagingResponse()
    tw.message(reply)
    return Response(content=str(tw), media_type="application/xml")

@api_router.patch("/admin/categories/{slug}")
async def admin_category_image(slug: str, data: CategoryImage, user=Depends(require_admin)):
    r = await db.categories.update_one({"slug": slug}, {"$set": {"image": data.image}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    return await db.categories.find_one({"slug": slug}, {"_id": 0})


@api_router.get("/admin/stats")
async def admin_stats(user=Depends(require_admin)):
    total_orders = await db.orders.count_documents({})
    total_products = await db.products.count_documents({"active": True})
    orders = await db.orders.find({}, {"_id": 0, "total": 1, "status": 1, "created_at": 1, "items": 1}).to_list(10000)
    paid = [o for o in orders if o.get("status") not in ("Menunggu Pembayaran", "Dibatalkan")]
    revenue = sum(o.get("total", 0) for o in paid)
    pending = sum(1 for o in orders if o.get("status") == "Menunggu Pembayaran")
    gross = lambda o: sum((i["price"] - (i.get("hpp") or 0)) * i["quantity"] for i in o.get("items", []))  # noqa: E731
    today = (datetime.now(timezone.utc) + timedelta(hours=7)).date()
    days = {(today - timedelta(days=d)).isoformat(): {"revenue": 0, "profit": 0, "orders": 0} for d in range(13, -1, -1)}
    for o in paid:
        d = (datetime.fromisoformat(o["created_at"]) + timedelta(hours=7)).date().isoformat()
        if d in days:
            days[d]["revenue"] += o.get("total", 0)
            days[d]["profit"] += gross(o)
            days[d]["orders"] += 1
    rv = await db.reviews.find({"hidden": False}, {"_id": 0, "rating": 1}).to_list(10000)
    recent = await db.orders.find({}, {"_id": 0, "order_id": 1, "user_name": 1, "total": 1, "status": 1, "created_at": 1, "courier": 1}) \
        .sort("created_at", -1).to_list(8)
    return {"total_orders": total_orders, "total_products": total_products, "revenue": revenue, "pending": pending,
            "gross_profit": sum(gross(o) for o in paid),
            "rating_avg": round(sum(r["rating"] for r in rv) / len(rv), 1) if rv else 0, "rating_count": len(rv),
            "daily": [{"date": k, **v} for k, v in days.items()], "recent_orders": recent}

@api_router.get("/admin/vouchers")
async def admin_list_vouchers(user=Depends(require_admin)):
    return await db.vouchers.find({}, {"_id": 0}).to_list(200)

@api_router.post("/admin/vouchers")
async def admin_create_voucher(data: VoucherInput, user=Depends(require_admin)):
    code = data.code.strip().upper()
    if await db.vouchers.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Kode voucher sudah ada")
    doc = data.model_dump()
    doc["code"] = code
    await db.vouchers.insert_one(dict(doc))
    return {k: v for k, v in doc.items()}

@api_router.patch("/admin/vouchers/{code}")
async def admin_update_voucher(code: str, data: dict, user=Depends(require_admin)):
    allowed = {k: v for k, v in data.items() if k in {"active", "value", "max_discount", "min_purchase", "description", "type"}}
    await db.vouchers.update_one({"code": code.upper()}, {"$set": allowed})
    return await db.vouchers.find_one({"code": code.upper()}, {"_id": 0})

@api_router.delete("/admin/vouchers/{code}")
async def admin_delete_voucher(code: str, user=Depends(require_admin)):
    await db.vouchers.delete_one({"code": code.upper()})
    return {"ok": True}


# ---------- Reviews ----------
class ReviewInput(BaseModel):
    product_id: str
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)
    images: List[str] = Field(default_factory=list, max_length=4)

class ReviewModerate(BaseModel):
    reply: Optional[str] = Field(default=None, max_length=1000)
    hidden: Optional[bool] = None

@api_router.post("/reviews/upload")
async def review_upload(file: UploadFile = File(...), user=Depends(get_current_user)):
    return {"url": await store_image(file, "reviews")}

@api_router.post("/orders/{order_id}/reviews")
async def create_review(order_id: str, data: ReviewInput, user=Depends(get_current_user)):
    o = await db.orders.find_one({"order_id": order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if o["status"] != "Selesai":
        raise HTTPException(status_code=400, detail="Ulasan hanya untuk pesanan yang sudah Selesai")
    item = next((i for i in o["items"] if i["product_id"] == data.product_id), None)
    if not item:
        raise HTTPException(status_code=400, detail="Produk tidak ada di pesanan ini")
    if any(not u.startswith("/api/files/") for u in data.images):
        raise HTTPException(status_code=400, detail="Foto ulasan tidak valid")
    if await db.reviews.find_one({"order_id": order_id, "product_id": data.product_id}):
        raise HTTPException(status_code=400, detail="Produk ini sudah Anda ulas")
    doc = {"review_id": f"rv_{uuid.uuid4().hex[:10]}", "order_id": order_id, "product_id": data.product_id,
           "product_name": item["name"], "variant_name": item.get("variant_name"), "user_id": user["user_id"],
           "user_name": user["name"], "rating": data.rating, "comment": data.comment.strip(), "images": data.images,
           "reply": "", "hidden": False, "created_at": now_iso()}
    await db.reviews.insert_one(dict(doc))
    await sync_product_rating(data.product_id)
    return doc

async def sync_product_rating(product_id: str):
    rs = await db.reviews.find({"product_id": product_id, "hidden": False}, {"_id": 0, "rating": 1}).to_list(5000)
    upd = {"review_count": len(rs)}
    if rs:
        upd["rating"] = round(sum(r["rating"] for r in rs) / len(rs), 1)
    await db.products.update_one({"product_id": product_id}, {"$set": upd})

@api_router.get("/orders/{order_id}/reviews")
async def order_reviews(order_id: str, user=Depends(get_current_user)):
    return await db.reviews.find({"order_id": order_id, "user_id": user["user_id"]}, {"_id": 0}).to_list(100)

@api_router.get("/products/{product_id}/reviews")
async def product_reviews(product_id: str):
    items = await db.reviews.find({"product_id": product_id, "hidden": False}, {"_id": 0, "user_id": 0, "order_id": 0}) \
        .sort("created_at", -1).to_list(200)
    avg = round(sum(r["rating"] for r in items) / len(items), 1) if items else 0
    return {"avg": avg, "count": len(items), "items": items}

@api_router.get("/admin/reviews")
async def admin_reviews(user=Depends(require_admin)):
    return await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.patch("/admin/reviews/{review_id}")
async def moderate_review(review_id: str, data: ReviewModerate, user=Depends(require_admin)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if "reply" in upd:
        upd["reply_at"] = now_iso()
    r = await db.reviews.find_one_and_update({"review_id": review_id}, {"$set": upd}, projection={"_id": 0}, return_document=True)
    if not r:
        raise HTTPException(status_code=404, detail="Ulasan tidak ditemukan")
    if "hidden" in upd:
        await sync_product_rating(r["product_id"])
    return r

# ---------- Recipes ----------
class RecipeIngredient(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    qty: str = Field(default="", max_length=60)
    product_id: Optional[str] = None

class RecipeInput(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=600)
    image: str = ""
    cook_minutes: int = Field(default=30, ge=1, le=1440)
    servings: int = Field(default=2, ge=1, le=50)
    ingredients: List[RecipeIngredient] = Field(default_factory=list, max_length=40)
    steps: List[str] = Field(default_factory=list, max_length=40)
    published: bool = True

def _recipe_summary(r: dict) -> dict:
    return {k: r.get(k) for k in ("recipe_id", "title", "description", "image", "cook_minutes", "servings", "published", "created_at")} | \
        {"ingredient_count": len(r.get("ingredients", []))}

@api_router.get("/recipes")
async def list_recipes():
    rs = await db.recipes.find({"published": True}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [_recipe_summary(r) for r in rs]

@api_router.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str):
    r = await db.recipes.find_one({"recipe_id": recipe_id, "published": True}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Resep tidak ditemukan")
    ids = [i["product_id"] for i in r["ingredients"] if i.get("product_id")]
    prods = await db.products.find({"product_id": {"$in": ids}, "active": True, "archived": {"$ne": True}}, {"_id": 0}).to_list(100)
    return {**r, "products": {p["product_id"]: p for p in prods}}

@api_router.get("/admin/recipes")
async def admin_recipes(user=Depends(require_admin)):
    return await db.recipes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

async def _check_recipe_products(data: RecipeInput):
    ids = {i.product_id for i in data.ingredients if i.product_id}
    if ids and await db.products.count_documents({"product_id": {"$in": list(ids)}}) != len(ids):
        raise HTTPException(status_code=400, detail="Ada bahan yang tertaut ke produk yang tidak ada")

@api_router.post("/admin/recipes")
async def create_recipe(data: RecipeInput, user=Depends(require_admin)):
    await _check_recipe_products(data)
    doc = {"recipe_id": f"rc_{uuid.uuid4().hex[:10]}", **data.model_dump(), "created_at": now_iso()}
    await db.recipes.insert_one(dict(doc))
    return doc

@api_router.put("/admin/recipes/{recipe_id}")
async def update_recipe(recipe_id: str, data: RecipeInput, user=Depends(require_admin)):
    await _check_recipe_products(data)
    extra = {"ai_draft": False, "approved_at": now_iso()} if data.published else {}
    r = await db.recipes.find_one_and_update({"recipe_id": recipe_id}, {"$set": {**data.model_dump(), **extra, "updated_at": now_iso()}},
                                             projection={"_id": 0}, return_document=True)
    if not r:
        raise HTTPException(status_code=404, detail="Resep tidak ditemukan")
    return r

@api_router.delete("/admin/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, user=Depends(require_admin)):
    await db.recipes.delete_one({"recipe_id": recipe_id})
    return {"ok": True}

class AiDraftInput(BaseModel):
    product_ids: List[str] = Field(default_factory=list, max_length=6)

RECIPE_SYSTEM = (f"Anda koki rumahan {CITY['cuisine']}. Tulis resep praktis berbahasa Indonesia untuk pelanggan toko sayur online. "
                 "Balas HANYA JSON valid tanpa teks lain dengan skema: {\"title\": str, \"description\": str (<=200 karakter), "
                 "\"cook_minutes\": int, \"servings\": int, \"ingredients\": [{\"name\": str, \"qty\": str, \"product_id\": str|null}], "
                 "\"steps\": [str]}. Gunakan product_id HANYA dari daftar katalog yang diberikan, bahan lain product_id null. 4-8 langkah.")

@api_router.post("/admin/recipes/ai-draft")
async def recipe_ai_draft(data: AiDraftInput, user=Depends(require_admin)):
    import json as _json
    import random
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    proj = {"_id": 0, "product_id": 1, "name": 1, "category_name": 1}
    base = {"active": True, "archived": {"$ne": True}}
    chosen = await db.products.find({**base, "product_id": {"$in": data.product_ids}}, proj).to_list(6) if data.product_ids else []
    pool = await db.products.find({**base, "category": {"$in": ["sayuran", "ikan-dan-daging", "bumbu-dapur", "bumbu-instan", "buah-buahan", "bahan-pokok", "kebutuhan-memasak"]}}, proj).to_list(600)
    catalog = chosen + random.sample(pool, min(60, len(pool)))
    lines = "\n".join(f"- {p['product_id']}: {p['name'][:80]}" for p in {p["product_id"]: p for p in catalog}.values())
    ask = (f"Buat resep yang WAJIB memakai produk berikut: {', '.join(p['name'][:60] for p in chosen)}." if chosen
           else "Pilih sendiri 3-6 produk dari katalog yang cocok jadi satu masakan rumahan khas {CITY['cuisine']}/Indonesia.")
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"recipe-draft-{uuid.uuid4().hex[:8]}", system_message=RECIPE_SYSTEM) \
        .with_model("anthropic", "claude-sonnet-4-5-20250929")
    try:
        raw = await chat.send_message(UserMessage(text=f"{ask}\n\nKatalog (product_id: nama):\n{lines}"))
        d = _json.loads(raw[raw.find("{"): raw.rfind("}") + 1])
        valid = {p["product_id"] for p in catalog}
        draft = RecipeInput(
            title=str(d["title"])[:120], description=str(d.get("description", ""))[:600],
            cook_minutes=max(1, min(int(d.get("cook_minutes", 30)), 1440)), servings=max(1, min(int(d.get("servings", 2)), 50)),
            ingredients=[RecipeIngredient(name=str(i["name"])[:120], qty=str(i.get("qty", ""))[:60],
                                          product_id=i.get("product_id") if i.get("product_id") in valid else None) for i in d["ingredients"][:40]],
            steps=[str(s) for s in d["steps"][:40]], published=False)
    except Exception as e:
        logger.error(f"AI recipe draft failed: {str(e)[:200]}")
        raise HTTPException(status_code=502, detail="AI gagal membuat draf, coba lagi")
    doc = {"recipe_id": f"rc_{uuid.uuid4().hex[:10]}", **draft.model_dump(), "ai_draft": True, "created_at": now_iso()}
    await db.recipes.insert_one(dict(doc))
    return doc

class RecipePromoInput(BaseModel):
    recipe_id: str
    discount_pct: int = Field(ge=1, le=50)

@api_router.get("/recipe-promo")
async def get_recipe_promo():
    pr = await active_recipe_promo()
    if not pr:
        return None
    ws = datetime.fromisoformat(pr["week_start"])
    return {"recipe_id": pr["recipe_id"], "discount_pct": pr["discount_pct"], "week_start": pr["week_start"],
            "ends_on": (ws + timedelta(days=6)).date().isoformat(), "product_ids": pr["product_ids"], "recipe": _recipe_summary(pr["recipe"])}

@api_router.put("/admin/recipe-promo")
async def set_recipe_promo(data: RecipePromoInput, user=Depends(require_admin)):
    if not await db.recipes.find_one({"recipe_id": data.recipe_id, "published": True}):
        raise HTTPException(status_code=400, detail="Resep harus sudah tayang untuk dijadikan promo")
    await db.settings.update_one({"key": "recipe_promo"}, {"$set": {**data.model_dump(), "week_start": week_start_wib()}}, upsert=True)
    return await get_recipe_promo()

@api_router.delete("/admin/recipe-promo")
async def clear_recipe_promo(user=Depends(require_admin)):
    await db.settings.delete_one({"key": "recipe_promo"})
    return {"ok": True}

@api_router.post("/admin/recipes/{recipe_id}/generate-image")
async def recipe_ai_image(recipe_id: str, user=Depends(require_admin)):
    import base64
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    r = await db.recipes.find_one({"recipe_id": recipe_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Resep tidak ditemukan")
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"recipe-{recipe_id}-{uuid.uuid4().hex[:6]}", system_message="You create food photography.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    prompt = (f"Professional appetizing food photograph of Indonesian dish '{r['title']}' ({CITY['cuisine']} style), served on a rustic plate, "
              "natural window light, top-down 45 degree angle, fresh ingredients around, no text, no watermark.")
    try:
        _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    except Exception as e:
        logger.error(f"Recipe image gen failed: {str(e)[:200]}")
        raise HTTPException(status_code=502, detail="Gagal membuat foto AI, coba lagi")
    if not images:
        raise HTTPException(status_code=502, detail="AI tidak menghasilkan foto, coba lagi")
    data = base64.b64decode(images[0]["data"])
    kind = sniff_image(data) or ("image/png", "png")
    url = await save_image_bytes(data, kind[0], kind[1], "recipes", f"{recipe_id}.{kind[1]}")
    await db.recipes.update_one({"recipe_id": recipe_id}, {"$set": {"image": url}})
    return {"image": url}


# ---------------- Email (Emergent managed Resend) ----------------
import ipaddress
import httpx
from html import escape as _esc
from html.parser import HTMLParser
from urllib.parse import urlparse

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = _re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", _re.I)

def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)

def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)

class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []
    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []

def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")

async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        try:
            code = e.response.json().get("code", "")
        except ValueError:
            code = ""
        if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning(f"Email paused: {code} ({e.response.status_code})")
            raise HTTPException(status_code=503, detail="Email sedang tidak tersedia, coba login dengan WhatsApp atau password")
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Gagal mengirim email")
    except httpx.HTTPError as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(status_code=502, detail="Gagal mengirim email")

def _otp_hash(email: str, code: str) -> str:
    return hmac.new(JWT_SECRET.encode(), f"{email}:{code}".encode(), hashlib.sha256).hexdigest()

class EmailOtpSend(BaseModel):
    email: EmailStr

class EmailOtpLogin(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)

@api_router.post("/auth/email-otp/send")
async def email_otp_send(data: EmailOtpSend):
    email = data.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0, "name": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Email belum terdaftar")
    now = datetime.now(timezone.utc)
    recent = await db.email_otps.find({"email": email, "at": {"$gt": (now - timedelta(hours=1)).isoformat()}}, {"_id": 0}).sort("at", -1).to_list(10)
    if recent and recent[0]["at"] > (now - timedelta(seconds=60)).isoformat():
        raise HTTPException(status_code=429, detail="Tunggu 60 detik sebelum meminta kode lagi")
    if len(recent) >= 5:
        raise HTTPException(status_code=429, detail="Terlalu banyak permintaan kode. Coba lagi 1 jam lagi")
    import secrets
    code = f"{secrets.randbelow(10**6):06d}"
    html = (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#0f172a">'
            f'<p>Halo {_esc(user["name"])},</p><p>Kode masuk akun {_esc(EMAIL_FROM_NAME)} Anda:</p>'
            f'<p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#059669">{code}</p>'
            f'<p>Kode berlaku 10 menit. Jika Anda tidak meminta kode ini, abaikan email ini.</p>'
            f'<p style="font-size:12px;color:#888">Dikirim oleh {_esc(EMAIL_FROM_NAME)}. Kami tidak pernah meminta password atau data kartu lewat email.</p>'
            f'</td></tr></table>')
    await send_email(to=email, subject=f"Kode masuk {EMAIL_FROM_NAME}: {code}", html=html)
    await db.email_otps.insert_one({"email": email, "hash": _otp_hash(email, code), "at": now.isoformat(),
                                    "expires_at": (now + timedelta(minutes=10)).isoformat(), "attempts": 0, "used": False})
    return {"ok": True}

@api_router.post("/auth/email-otp/login")
async def email_otp_login(data: EmailOtpLogin):
    email = data.email.lower()
    rec = await db.email_otps.find_one({"email": email, "used": False, "purpose": {"$ne": "signup"}}, {"_id": 0}, sort=[("at", -1)])
    bad = HTTPException(status_code=401, detail="Kode salah atau kedaluwarsa")
    if not rec or rec["expires_at"] < now_iso() or rec["attempts"] >= 5:
        raise bad
    if not hmac.compare_digest(rec["hash"], _otp_hash(email, data.code.strip())):
        await db.email_otps.update_one({"email": email, "at": rec["at"]}, {"$inc": {"attempts": 1}})
        raise bad
    r = await db.email_otps.update_one({"email": email, "at": rec["at"], "used": False}, {"$set": {"used": True}})
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not r.modified_count or not user:
        raise bad
    return {"token": make_jwt(user["user_id"]), "user": public_user(user)}


# ---------------- Akun Saya ----------------
class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: Optional[str] = ""

@api_router.put("/auth/profile")
async def update_profile(data: ProfileUpdate, user=Depends(get_current_user)):
    email = data.email.lower()
    upd = {"name": data.name.strip()}
    if email != user["email"]:
        if not user.get("password"):
            raise HTTPException(status_code=400, detail="Email akun Google tidak bisa diubah")
        if await db.users.find_one({"email": email, "user_id": {"$ne": user["user_id"]}}):
            raise HTTPException(status_code=400, detail="Email sudah dipakai akun lain")
        upd["email"] = email
    phone = normalize_phone(data.phone) if (data.phone or "").strip() else None
    if phone != user.get("phone"):
        if phone and await db.users.find_one({"phone": phone, "user_id": {"$ne": user["user_id"]}}):
            raise HTTPException(status_code=400, detail="Nomor sudah dipakai akun lain")
        upd.update(phone=phone, phone_verified=False)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    return public_user(await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0}))


# ---------------- Metode Pengembalian Dana ----------------
# Konsumen memilih ke mana refund (pembatalan pesanan yang sudah dibayar / komplain disetujui) dikirim:
# "saldo" = langsung masuk saldo toko (instan), "bank" = ditransfer admin ke rekening / e-wallet (tanpa biaya).
class RefundMethodInput(BaseModel):
    method: Literal["saldo", "bank"] = "saldo"
    bank_name: str = Field(default="", max_length=40)
    account_number: str = Field(default="", max_length=20)
    account_name: str = Field(default="", max_length=80)

def _refund_method(u: dict) -> dict:
    m = (u or {}).get("refund_method") or {}
    return {"method": m.get("method", "saldo"), "bank_name": m.get("bank_name", ""),
            "account_number": m.get("account_number", ""), "account_name": m.get("account_name", "")}

@api_router.get("/auth/refund-method")
async def get_refund_method(user=Depends(get_current_user)):
    items = await db.refund_transfers.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {**_refund_method(user), "transfers": items}

@api_router.put("/auth/refund-method")
async def set_refund_method(data: RefundMethodInput, user=Depends(get_current_user)):
    doc = {"method": data.method, "bank_name": data.bank_name.strip(), "account_number": data.account_number.strip(),
           "account_name": data.account_name.strip()}
    if data.method == "bank" and (len(doc["bank_name"]) < 2 or len(doc["account_name"]) < 2
                                  or not _re.fullmatch(r"\d{5,20}", doc["account_number"])):
        raise HTTPException(status_code=400, detail="Lengkapi nama bank / e-wallet, nomor rekening (angka) dan nama pemilik")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"refund_method": doc}})
    return doc

async def refund_customer(user_id: str, amount: int, ref: str, note: str) -> str:
    """Kirim refund sesuai Metode Pengembalian Dana konsumen. Kembalikan "saldo" atau "bank"."""
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "email": 1, "refund_method": 1})
    m = _refund_method(u)
    if m["method"] == "bank" and m["account_number"]:
        rid = f"RF{datetime.now(WIB).strftime('%y%m%d')}{uuid.uuid4().hex[:5].upper()}"
        await db.refund_transfers.insert_one({"refund_id": rid, "user_id": user_id, "user_name": (u or {}).get("name", ""),
                                              "user_email": (u or {}).get("email", ""), "amount": amount, "ref": ref, "note": note,
                                              "bank_name": m["bank_name"], "account_number": m["account_number"],
                                              "account_name": m["account_name"], "status": "pending", "created_at": now_iso()})
        return "bank"
    await wallet_credit(user_id, amount, "refund", ref, note)
    return "saldo"

@api_router.get("/admin/refund-transfers")
async def admin_refund_transfers(user=Depends(require_admin)):
    return await db.refund_transfers.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

class RefundDecision(BaseModel):
    approve: bool
    note: str = Field(default="", max_length=200)

@api_router.post("/admin/refund-transfers/{rid}/decide")
async def admin_refund_decide(rid: str, data: RefundDecision, user=Depends(require_admin)):
    status = "done" if data.approve else "to_saldo"
    r = await db.refund_transfers.find_one_and_update({"refund_id": rid, "status": "pending"},
                                                      {"$set": {"status": status, "admin_note": data.note, "decided_at": now_iso(), "decided_by": user["name"]}})
    if not r:
        raise HTTPException(status_code=400, detail="Refund tidak ditemukan atau sudah diproses")
    if not data.approve:  # rekening bermasalah: dana tetap sampai ke konsumen lewat Saldo
        await wallet_credit(r["user_id"], r["amount"], "refund", r["ref"],
                            f"{r['note']} (transfer gagal, dialihkan ke Saldo{': ' + data.note if data.note else ''})")
    return {"ok": True, "status": status}


# ---------------- Setoran COD ----------------
def _cod_day(o: dict) -> str:
    return o.get("delivery_date") or (datetime.fromisoformat(o["created_at"]) + timedelta(hours=7)).date().isoformat()

@api_router.get("/admin/reports/cod")
async def cod_report(start: str, end: str, user=Depends(require_admin)):
    lo = (datetime.fromisoformat(start) - timedelta(days=1)).isoformat()
    hi = (datetime.fromisoformat(end) + timedelta(days=2)).isoformat()
    orders = await db.orders.find({"payment_method": "cod", "status": {"$ne": "Dibatalkan"},
                                   "$or": [{"delivery_date": {"$gte": start, "$lte": end}}, {"created_at": {"$gte": lo, "$lte": hi}}]},
                                  {"_id": 0, "items": 0}).to_list(20000)
    deps = {d["date"]: d for d in await db.cod_deposits.find({"date": {"$gte": start, "$lte": end}}, {"_id": 0}).to_list(1000)}
    days = {}
    for o in orders:
        d = _cod_day(o)
        if not (start <= d <= end):
            continue
        r = days.setdefault(d, {"date": d, "orders": 0, "due": 0, "collected": 0, "outstanding": 0, "order_ids": []})
        r["orders"] += 1
        r["due"] += o["total"]
        r["order_ids"].append(o["order_id"])
        if o["status"] == "Selesai":
            r["collected"] += o["total"]
        else:
            r["outstanding"] += o["total"]
    rows = []
    for d in sorted(days, reverse=True):
        dep = deps.get(d) or {}
        rows.append({**days[d], "deposited": bool(dep.get("deposited")), "deposited_amount": dep.get("amount", 0),
                     "deposited_at": dep.get("at"), "difference": days[d]["collected"] - dep.get("amount", 0) if dep.get("deposited") else None})
    tot = {k: sum(r[k] for r in rows) for k in ("orders", "due", "collected", "outstanding")}
    tot["deposited"] = sum(r["deposited_amount"] for r in rows if r["deposited"])
    return {"days": rows, "summary": tot}

class CodDeposit(BaseModel):
    deposited: bool
    amount: Optional[int] = Field(default=None, ge=0)

@api_router.put("/admin/reports/cod/{date}")
async def cod_mark_deposit(date: str, data: CodDeposit, user=Depends(require_admin)):
    if not _re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise HTTPException(status_code=400, detail="Format tanggal YYYY-MM-DD")
    if not data.deposited:
        await db.cod_deposits.delete_one({"date": date})
        return {"ok": True}
    rep = await cod_report(date, date, user)
    collected = rep["days"][0]["collected"] if rep["days"] else 0
    await db.cod_deposits.update_one({"date": date}, {"$set": {"date": date, "deposited": True, "by": user["name"], "at": now_iso(),
                                                              "amount": collected if data.amount is None else data.amount}}, upsert=True)
    return {"ok": True}


# ---------------- Affiliate ----------------
def _new_ref_code() -> str:
    return uuid.uuid4().hex[:8].upper()

async def _pct_map() -> dict:
    return {c["slug"]: c.get("affiliate_pct", 0) for c in await db.categories.find({}, {"_id": 0, "slug": 1, "affiliate_pct": 1}).to_list(500)}

def _eff_pct(p: dict, cats: dict) -> float:
    return p["affiliate_pct"] if p.get("affiliate_pct") is not None else cats.get(p.get("category"), 0)

async def affiliate_for_order(ref_code: str, buyer: dict, items: list) -> Optional[dict]:
    code = (ref_code or "").strip().upper()
    if not code:
        return None
    aff = await db.users.find_one({"ref_code": code}, {"_id": 0, "user_id": 1, "name": 1})
    if not aff or aff["user_id"] == buyer["user_id"]:
        return None
    cats = await _pct_map()
    prods = {p["product_id"]: p for p in await db.products.find({"product_id": {"$in": [i["product_id"] for i in items]}},
                                                                 {"_id": 0, "product_id": 1, "category": 1, "affiliate_pct": 1}).to_list(500)}
    amount = sum(round(i["price"] * i["quantity"] * _eff_pct(prods.get(i["product_id"], {}), cats) / 100) for i in items)
    if amount <= 0:
        return None
    return {"user_id": aff["user_id"], "name": aff["name"], "ref_code": code, "amount": amount, "status": "pending"}

@api_router.get("/affiliate/me")
async def affiliate_me(user=Depends(get_current_user)):
    code = user.get("ref_code")
    if not code:
        code = _new_ref_code()
        await db.users.update_one({"user_id": user["user_id"], "ref_code": {"$exists": False}}, {"$set": {"ref_code": code}})
        code = (await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "ref_code": 1}))["ref_code"]
    orders = await db.orders.find({"affiliate.user_id": user["user_id"]},
                                  {"_id": 0, "order_id": 1, "created_at": 1, "status": 1, "subtotal": 1, "affiliate": 1}).sort("created_at", -1).to_list(500)
    sums = {s: sum(o["affiliate"]["amount"] for o in orders if o["affiliate"]["status"] == s) for s in ("pending", "paid", "cancelled")}
    clicks = await db.affiliate_clicks.count_documents({"ref_code": code})
    return {"ref_code": code, "clicks": clicks, "orders": len(orders), "pending": sums["pending"], "paid": sums["paid"],
            "commission_balance": await commission_balance(user["user_id"]),
            "history": [{"order_id": o["order_id"], "created_at": o["created_at"], "status": o["status"], "subtotal": o["subtotal"],
                         "amount": o["affiliate"]["amount"], "commission_status": o["affiliate"]["status"]} for o in orders[:100]]}

@api_router.get("/affiliate/leaderboard")
async def affiliate_leaderboard(metric: str = "commission", month: Optional[str] = None, user=Depends(get_current_user)):
    if user.get("role") != "admin" and not user.get("ref_code"):
        raise HTTPException(status_code=403, detail="Khusus mitra affiliate")
    if metric not in ("commission", "orders", "clicks"):
        raise HTTPException(status_code=400, detail="Metrik tidak valid")
    month = month or wib_today()[:7]
    if not _re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise HTTPException(status_code=400, detail="Format bulan YYYY-MM")
    y, m = int(month[:4]), int(month[5:])
    start = datetime(y, m, 1, tzinfo=timezone.utc) - timedelta(hours=7)
    end = datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=timezone.utc) - timedelta(hours=7)
    rows = await db.orders.aggregate([
        {"$match": {"affiliate.user_id": {"$exists": True}, "affiliate.status": {"$ne": "cancelled"}, "status": {"$ne": "Dibatalkan"},
                    "created_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}}},
        {"$group": {"_id": "$affiliate.user_id", "commission": {"$sum": "$affiliate.amount"}, "orders": {"$sum": 1}}},
    ]).to_list(5000)
    stats = {r["_id"]: {"commission": r["commission"], "orders": r["orders"], "clicks": 0} for r in rows}
    clicks = await db.affiliate_clicks.aggregate([
        {"$match": {"date": {"$regex": f"^{month}"}}}, {"$group": {"_id": "$ref_code", "n": {"$sum": 1}}}]).to_list(5000)
    codes = {c["_id"]: c["n"] for c in clicks}
    users = await db.users.find({"$or": [{"user_id": {"$in": list(stats)}}, {"ref_code": {"$in": list(codes)}}]},
                                {"_id": 0, "user_id": 1, "name": 1, "ref_code": 1}).to_list(5000)
    out = []
    for u in users:
        s = stats.get(u["user_id"], {"commission": 0, "orders": 0, "clicks": 0})
        s["clicks"] = codes.get(u.get("ref_code"), 0)
        out.append({"user_id": u["user_id"], "name": u.get("name") or "-", "ref_code": u.get("ref_code", ""), **s})
    out = [x for x in out if x[metric] > 0]
    out.sort(key=lambda x: (-x[metric], -x["commission"], -x["orders"]))
    for i, x in enumerate(out):
        x["rank"] = i + 1
    me = next((x for x in out if x["user_id"] == user["user_id"]), None)
    strip = lambda x: {k: v for k, v in x.items() if k != "user_id"}  # noqa: E731
    return {"month": month, "metric": metric, "top": [strip(x) for x in out[:20]], "me": strip(me) if me else None,
            "total": len(out)}

@api_router.get("/affiliate/products")
async def affiliate_products(search: str = ""):
    cats = await _pct_map()
    q = {"active": True, "archived": {"$ne": True}, "stock": {"$gt": 0}}
    if search:
        q["name"] = {"$regex": _re.escape(search[:80]), "$options": "i"}
    out = []
    for p in await db.products.find(q, {"_id": 0, "product_id": 1, "name": 1, "image": 1, "final_price": 1, "category": 1, "affiliate_pct": 1}).to_list(2000):
        pct = _eff_pct(p, cats)
        if pct > 0:
            out.append({**p, "pct": pct, "commission": round(p["final_price"] * pct / 100)})
    return sorted(out, key=lambda x: -x["commission"])[:60]

class RefClick(BaseModel):
    ref_code: str = Field(max_length=20)

@api_router.post("/affiliate/click")
async def affiliate_click(data: RefClick, request: Request):
    code = data.ref_code.strip().upper()
    if await db.users.find_one({"ref_code": code}, {"_id": 1}):
        ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "").split(",")[0]
        day = wib_today()
        await db.affiliate_clicks.update_one({"ref_code": code, "ip": ip, "date": day}, {"$setOnInsert": {"at": now_iso()}}, upsert=True)
    return {"ok": True}

class PctInput(BaseModel):
    pct: Optional[float] = Field(default=None, ge=0, le=50)

@api_router.get("/admin/affiliate")
async def admin_affiliate(user=Depends(require_admin)):
    cats = await db.categories.find({}, {"_id": 0, "slug": 1, "name": 1, "affiliate_pct": 1}).sort("name", 1).to_list(500)
    overrides = await db.products.find({"affiliate_pct": {"$ne": None, "$exists": True}},
                                       {"_id": 0, "product_id": 1, "name": 1, "image": 1, "category": 1, "affiliate_pct": 1, "final_price": 1}).to_list(1000)
    agg = await db.orders.aggregate([{"$match": {"affiliate": {"$exists": True}}},
                                     {"$group": {"_id": "$affiliate.user_id", "name": {"$first": "$affiliate.name"},
                                                 "ref_code": {"$first": "$affiliate.ref_code"}, "orders": {"$sum": 1},
                                                 "pending": {"$sum": {"$cond": [{"$eq": ["$affiliate.status", "pending"]}, "$affiliate.amount", 0]}},
                                                 "paid": {"$sum": {"$cond": [{"$eq": ["$affiliate.status", "paid"]}, "$affiliate.amount", 0]}},
                                                 "sales": {"$sum": {"$cond": [{"$ne": ["$affiliate.status", "cancelled"]}, "$subtotal", 0]}}}},
                                     {"$sort": {"paid": -1}}]).to_list(200)
    return {"categories": [{**c, "affiliate_pct": c.get("affiliate_pct", 0)} for c in cats], "overrides": overrides,
            "affiliates": [{**a, "user_id": a.pop("_id")} for a in agg]}

@api_router.put("/admin/affiliate/category/{slug}")
async def admin_affiliate_cat(slug: str, data: PctInput, user=Depends(require_admin)):
    r = await db.categories.update_one({"slug": slug}, {"$set": {"affiliate_pct": data.pct or 0}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    return {"ok": True}

@api_router.put("/admin/affiliate/product/{product_id}")
async def admin_affiliate_product(product_id: str, data: PctInput, user=Depends(require_admin)):
    r = await db.products.update_one({"product_id": product_id}, {"$set": {"affiliate_pct": data.pct}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return {"ok": True}



# ---------------- Merge duplicate accounts ----------------
USER_REF_COLLECTIONS = ("orders", "addresses", "carts", "complaints", "reviews", "topups", "wallet_tx", "user_sessions", "withdrawals")

async def merge_duplicate_users() -> int:
    merged = 0
    dups = await db.users.aggregate([{"$group": {"_id": "$email", "n": {"$sum": 1}}}, {"$match": {"n": {"$gt": 1}, "_id": {"$ne": None}}}]).to_list(1000)
    for d in dups:
        users = await db.users.find({"email": d["_id"]}, {"_id": 0}).sort("created_at", 1).to_list(20)
        keep, others = users[0], users[1:]
        for u in others:
            old = u["user_id"]
            for c in USER_REF_COLLECTIONS:
                await db[c].update_many({"user_id": old}, {"$set": {"user_id": keep["user_id"]}})
            await db.orders.update_many({"affiliate.user_id": old}, {"$set": {"affiliate.user_id": keep["user_id"]}})
            await db.messages.update_many({"conversation_id": old}, {"$set": {"conversation_id": keep["user_id"]}})
            conv = await db.conversations.find_one({"conversation_id": old}, {"_id": 0})
            if conv and not await db.conversations.find_one({"conversation_id": keep["user_id"]}):
                await db.conversations.update_one({"conversation_id": old}, {"$set": {"conversation_id": keep["user_id"]}})
            else:
                await db.conversations.delete_one({"conversation_id": old})
            fill = {k: u[k] for k in ("password", "phone", "picture", "ref_code") if u.get(k) and not keep.get(k)}
            if u.get("phone_verified") and not keep.get("phone_verified") and "phone" in fill:
                fill["phone_verified"] = True
            if u.get("role") == "admin":
                fill["role"] = "admin"
            await db.users.update_one({"user_id": keep["user_id"]}, {"$set": fill, "$inc": {"balance": u.get("balance", 0) or 0}})
            keep.update(fill)
            await db.users.delete_one({"user_id": old})
            merged += 1
            logger.info(f"Merged duplicate user {old} into {keep['user_id']}")
    return merged


# ---------------- Signup email verification ----------------
class SignupEmailSend(BaseModel):
    email: EmailStr

@api_router.post("/auth/signup-email/send")
async def signup_email_send(data: SignupEmailSend):
    email = data.email.lower()
    if await db.users.find_one({"email": email}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar, silakan masuk")
    now = datetime.now(timezone.utc)
    recent = await db.email_otps.find({"email": email, "at": {"$gt": (now - timedelta(hours=1)).isoformat()}}, {"_id": 0}).sort("at", -1).to_list(10)
    if recent and recent[0]["at"] > (now - timedelta(seconds=60)).isoformat():
        raise HTTPException(status_code=429, detail="Tunggu 60 detik sebelum meminta kode lagi")
    if len(recent) >= 5:
        raise HTTPException(status_code=429, detail="Terlalu banyak permintaan kode. Coba lagi 1 jam lagi")
    import secrets
    code = f"{secrets.randbelow(10**6):06d}"
    html = (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#0f172a">'
            f'<p>Terima kasih sudah mendaftar di {_esc(EMAIL_FROM_NAME)}.</p><p>Kode verifikasi email Anda:</p>'
            f'<p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#059669">{code}</p>'
            f'<p>Kode berlaku 10 menit. Jika Anda tidak mendaftar, abaikan email ini.</p></td></tr></table>')
    await send_email(to=email, subject=f"Kode verifikasi {EMAIL_FROM_NAME}: {code}", html=html)
    await db.email_otps.insert_one({"email": email, "hash": _otp_hash(email, code), "at": now.isoformat(), "purpose": "signup",
                                    "expires_at": (now + timedelta(minutes=10)).isoformat(), "attempts": 0, "used": False})
    return {"ok": True}

async def consume_email_otp(email: str, code: str, purpose: str) -> bool:
    rec = await db.email_otps.find_one({"email": email, "used": False, "purpose": purpose}, {"_id": 0}, sort=[("at", -1)])
    if not rec or rec["expires_at"] < now_iso() or rec["attempts"] >= 5:
        return False
    if not hmac.compare_digest(rec["hash"], _otp_hash(email, (code or "").strip())):
        await db.email_otps.update_one({"email": email, "at": rec["at"]}, {"$inc": {"attempts": 1}})
        return False
    r = await db.email_otps.update_one({"email": email, "at": rec["at"], "used": False}, {"$set": {"used": True}})
    return bool(r.modified_count)


# ---------------- Affiliate withdrawals ----------------
# Komisi affiliate masuk ke "Saldo Komisi" (users.commission_balance), terpisah dari Saldo belanja.
# Dari Saldo Komisi, affiliate memilih: pindah ke Saldo (gratis, langsung) atau tarik ke rekening
# (biaya Rp2.500, admin mentransfer manual lalu menandai "Sudah ditransfer").
WITHDRAW_MIN, WITHDRAW_FEE = 50000, 2500
TO_SALDO_MIN = 1000

async def commission_tx(user_id, amount, kind, ref, note):
    await db.commission_tx.insert_one({"tx_id": f"ctx_{uuid.uuid4().hex[:12]}", "user_id": user_id, "amount": amount,
                                       "type": kind, "ref": ref, "note": note, "created_at": now_iso()})

async def commission_credit(user_id, amount, kind, ref, note):
    await db.users.update_one({"user_id": user_id}, {"$inc": {"commission_balance": amount}})
    await commission_tx(user_id, amount, kind, ref, note)

async def commission_debit(user_id, amount, kind, ref, note) -> bool:
    r = await db.users.update_one({"user_id": user_id, "commission_balance": {"$gte": amount}}, {"$inc": {"commission_balance": -amount}})
    if r.modified_count:
        await commission_tx(user_id, -amount, kind, ref, note)
    return bool(r.modified_count)

async def commission_balance(user_id: str) -> int:
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "commission_balance": 1})
    return max(0, (u or {}).get("commission_balance", 0) or 0)

async def migrate_commission_wallet():
    """Sekali jalan: komisi lama yang dulu langsung masuk Saldo dan belum ditarik/terpakai dipindah ke Saldo Komisi."""
    for uid in await db.wallet_tx.distinct("user_id", {"type": "affiliate"}):
        earned = await db.wallet_tx.aggregate([{"$match": {"user_id": uid, "type": "affiliate"}}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}]).to_list(1)
        held = await db.withdrawals.aggregate([{"$match": {"user_id": uid, "status": {"$in": ["pending", "approved"]}}}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}]).to_list(1)
        u = await db.users.find_one({"user_id": uid}, {"_id": 0, "balance": 1})
        amt = max(0, min((earned[0]["s"] if earned else 0) - (held[0]["s"] if held else 0), (u or {}).get("balance", 0) or 0))
        if amt and await wallet_debit(uid, amt, "commission_move", "migrasi", "Komisi affiliate dipindah ke Saldo Komisi"):
            await commission_credit(uid, amt, "migrated", "migrasi", "Komisi dari Saldo (pemindahan sistem)")

class WithdrawInput(BaseModel):
    method: Literal["saldo", "bank"] = "bank"
    amount: int = Field(ge=TO_SALDO_MIN)
    bank_name: str = Field(default="", max_length=40)
    account_number: str = Field(default="", max_length=20)
    account_name: str = Field(default="", max_length=80)

@api_router.get("/affiliate/withdrawals")
async def my_withdrawals(user=Depends(get_current_user)):
    items = await db.withdrawals.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    last_bank = next((w for w in items if w.get("method", "bank") == "bank"), None)
    return {"available": await commission_balance(user["user_id"]), "min": WITHDRAW_MIN, "fee": WITHDRAW_FEE, "saldo_min": TO_SALDO_MIN,
            "last_account": {k: last_bank[k] for k in ("bank_name", "account_number", "account_name")} if last_bank else None,
            "items": items}

def _wid():
    return f"WD{datetime.now(WIB).strftime('%y%m%d')}{uuid.uuid4().hex[:5].upper()}"

@api_router.post("/affiliate/withdrawals")
async def request_withdrawal(data: WithdrawInput, user=Depends(get_current_user)):
    uid = user["user_id"]
    if data.amount > await commission_balance(uid):
        raise HTTPException(status_code=400, detail="Jumlah melebihi Saldo Komisi")
    base = {"user_id": uid, "user_name": user["name"], "user_email": user["email"], "amount": data.amount,
            "method": data.method, "source": "commission", "created_at": now_iso()}
    if data.method == "saldo":
        wid = _wid()
        if not await commission_debit(uid, data.amount, "to_saldo", wid, f"Pindah ke Saldo {wid}"):
            raise HTTPException(status_code=400, detail="Saldo Komisi tidak cukup")
        await wallet_credit(uid, data.amount, "commission", wid, "Komisi affiliate dipindah ke Saldo")
        doc = {**base, "withdrawal_id": wid, "fee": 0, "transfer_amount": data.amount, "status": "done", "decided_at": now_iso()}
        await db.withdrawals.insert_one(dict(doc))
        return doc
    if data.amount < WITHDRAW_MIN:
        raise HTTPException(status_code=400, detail=f"Minimal tarik ke rekening Rp{WITHDRAW_MIN:,}".replace(",", "."))
    bank, acc, name = data.bank_name.strip(), data.account_number.strip(), data.account_name.strip()
    if len(bank) < 2 or len(name) < 2 or not _re.fullmatch(r"\d{5,20}", acc):
        raise HTTPException(status_code=400, detail="Lengkapi nama bank, nomor rekening (angka) dan nama pemilik rekening")
    if await db.withdrawals.find_one({"user_id": uid, "status": "pending"}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="Masih ada penarikan yang menunggu transfer admin")
    wid = _wid()
    doc = {**base, "withdrawal_id": wid, "bank_name": bank, "account_number": acc, "account_name": name,
           "fee": WITHDRAW_FEE, "transfer_amount": data.amount - WITHDRAW_FEE, "status": "pending"}
    try:
        await db.withdrawals.insert_one(dict(doc))
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Masih ada penarikan yang menunggu transfer admin")
    if not await commission_debit(uid, data.amount, "withdrawal", wid, f"Tarik ke rekening {wid}"):
        await db.withdrawals.delete_one({"withdrawal_id": wid})
        raise HTTPException(status_code=400, detail="Saldo Komisi tidak cukup")
    return doc

@api_router.get("/admin/withdrawals")
async def admin_withdrawals(user=Depends(require_admin)):
    return await db.withdrawals.find({"method": {"$ne": "saldo"}}, {"_id": 0}).sort("created_at", -1).to_list(500)

class WithdrawDecision(BaseModel):
    approve: bool
    note: str = Field(default="", max_length=200)

@api_router.post("/admin/withdrawals/{wid}/decide")
async def admin_withdraw_decide(wid: str, data: WithdrawDecision, user=Depends(require_admin)):
    status = "approved" if data.approve else "rejected"
    w = await db.withdrawals.find_one_and_update({"withdrawal_id": wid, "status": "pending"},
                                                 {"$set": {"status": status, "note": data.note, "decided_at": now_iso(), "decided_by": user["name"]}})
    if not w:
        raise HTTPException(status_code=400, detail="Penarikan tidak ditemukan atau sudah diproses")
    if not data.approve:
        note = f"Penarikan {wid} ditolak{': ' + data.note if data.note else ''}"
        if w.get("source") == "commission":
            await commission_credit(w["user_id"], w["amount"], "withdrawal_refund", wid, note)
        else:  # pengajuan lama (sebelum Saldo Komisi) dipotong dari Saldo
            await wallet_credit(w["user_id"], w["amount"], "withdrawal_refund", wid, note)
    return {"ok": True, "status": status}


# ---------------- Promo card image proxy ----------------
@api_router.get("/products/{product_id}/card-image")
async def product_card_image(product_id: str):
    p = await db.products.find_one({"product_id": product_id}, {"_id": 0, "image": 1})
    if not p or not (p.get("image") or "").startswith("https://"):
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan")
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
        r = await c.get(p["image"])
    ctype = r.headers.get("content-type", "")
    if r.status_code != 200 or ctype.split(";")[0] not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=502, detail="Gagal memuat gambar")
    return Response(content=r.content, media_type=ctype.split(";")[0], headers={"Cache-Control": "public, max-age=86400"})


# ---------------- Admin chat unread ----------------
@api_router.get("/admin/chat/unread")
async def admin_chat_unread(user=Depends(require_admin)):
    agg = await db.conversations.aggregate([{"$group": {"_id": None, "s": {"$sum": "$unread_admin"}, "c": {"$sum": {"$cond": [{"$gt": ["$unread_admin", 0]}, 1, 0]}}}}]).to_list(1)
    return {"unread": agg[0]["s"] if agg else 0, "conversations": agg[0]["c"] if agg else 0}



# ---------------- Poin pembeli & voucher transaksi pertama ----------------
# 1 poin untuk setiap Rp1.000 belanja pada pesanan berstatus "Selesai".
# Poin bisa ditukar ke Saldo: POINT_VALUE rupiah per poin (default Rp10 = cashback 1%).
POINT_PER_RUPIAH = 1000
POINT_VALUE = int(os.environ.get("POINT_VALUE", "10"))
POINT_MIN_REDEEM = 100
FIRST_ORDER_VOUCHER = {
    "code": "BELANJAPERTAMA", "type": "fixed", "value": 15000, "max_discount": 15000, "min_purchase": 110000,
    "first_order": True, "description": "Potongan Rp15.000 untuk transaksi pertama, min belanja Rp110.000", "active": True,
}

async def points_summary(user):
    done = await db.orders.find({"user_id": user["user_id"], "status": "Selesai"}, {"_id": 0, "total": 1}).to_list(5000)
    earned = sum(int(o.get("total") or 0) // POINT_PER_RUPIAH for o in done)
    redeemed = int(user.get("points_redeemed") or 0)
    return {"earned": earned, "redeemed": redeemed, "available": max(0, earned - redeemed),
            "point_value": POINT_VALUE, "min_redeem": POINT_MIN_REDEEM, "per_rupiah": POINT_PER_RUPIAH}

@api_router.get("/points")
async def my_points(user=Depends(get_current_user)):
    summary = await points_summary(user)
    first = await db.vouchers.find_one({"code": FIRST_ORDER_VOUCHER["code"], "active": True}, {"_id": 0})
    summary["first_order_voucher"] = first if first and not await has_previous_order(user["user_id"]) else None
    return summary

class PointsRedeem(BaseModel):
    points: int = Field(ge=1)

@api_router.post("/points/redeem")
async def redeem_points(data: PointsRedeem, user=Depends(get_current_user)):
    summary = await points_summary(user)
    if data.points < POINT_MIN_REDEEM:
        raise HTTPException(status_code=400, detail=f"Minimal tukar {POINT_MIN_REDEEM} poin")
    if data.points > summary["available"]:
        raise HTTPException(status_code=400, detail="Poin tidak cukup")
    # Kunci optimistis: hanya berhasil jika points_redeemed belum berubah sejak dibaca.
    r = await db.users.update_one(
        {"user_id": user["user_id"], "points_redeemed": user.get("points_redeemed") if user.get("points_redeemed") is not None else None},
        {"$inc": {"points_redeemed": data.points}})
    if not r.modified_count:
        raise HTTPException(status_code=409, detail="Poin sedang diproses, coba lagi")
    amount = data.points * POINT_VALUE
    await wallet_credit(user["user_id"], amount, "points", f"pts_{uuid.uuid4().hex[:10]}", f"Tukar {data.points} poin")
    return {"redeemed": data.points, "amount": amount, "available": summary["available"] - data.points}


# ---------------- Paket langganan mingguan ----------------
# Pembeli menyimpan isi keranjang sebagai paket mingguan + hari kirim. Di hari itu (dan sehari sebelumnya)
# Beranda menampilkan paket untuk dimasukkan ke keranjang dengan 1 ketukan. Tidak ada pesanan/pembayaran otomatis.
SUB_DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

class SubscriptionItem(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    name: str = ""
    variant_name: Optional[str] = None
    image: str = ""
    quantity: int = Field(ge=1, le=99)

class SubscriptionInput(BaseModel):
    name: str = Field(default="Paket Mingguan", min_length=1, max_length=60)
    day: int = Field(ge=0, le=6)  # 0 = Senin
    items: List[SubscriptionItem] = Field(min_length=1, max_length=60)
    active: bool = True

@api_router.get("/subscriptions")
async def my_subscriptions(user=Depends(get_current_user)):
    return await db.subscriptions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)

@api_router.post("/subscriptions")
async def create_subscription(data: SubscriptionInput, user=Depends(get_current_user)):
    if await db.subscriptions.count_documents({"user_id": user["user_id"]}) >= 5:
        raise HTTPException(status_code=400, detail="Maksimal 5 paket langganan")
    doc = {"subscription_id": f"sub_{uuid.uuid4().hex[:10]}", "user_id": user["user_id"], "user_name": user.get("name", ""),
           **data.model_dump(), "day_name": SUB_DAYS[data.day], "created_at": now_iso(), "updated_at": now_iso()}
    await db.subscriptions.insert_one(dict(doc))
    return clean(doc)

@api_router.put("/subscriptions/{sid}")
async def update_subscription(sid: str, data: SubscriptionInput, user=Depends(get_current_user)):
    upd = {**data.model_dump(), "day_name": SUB_DAYS[data.day], "updated_at": now_iso()}
    r = await db.subscriptions.update_one({"subscription_id": sid, "user_id": user["user_id"]}, {"$set": upd})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    return await db.subscriptions.find_one({"subscription_id": sid}, {"_id": 0})

@api_router.delete("/subscriptions/{sid}")
async def delete_subscription(sid: str, user=Depends(get_current_user)):
    r = await db.subscriptions.delete_one({"subscription_id": sid, "user_id": user["user_id"]})
    if not r.deleted_count:
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    return {"ok": True}

@api_router.get("/admin/subscriptions")
async def admin_subscriptions(admin=Depends(require_admin)):
    return await db.subscriptions.find({}, {"_id": 0}).sort("day", 1).to_list(1000)

# ---------------- Kasir Toko (POS) ----------------
# Penjualan langsung di toko. Produk & stok sama dengan katalog web; laporan dipisah dari pesanan web.
POS_PAYMENTS = {"cash": "Tunai", "qris": "QRIS", "transfer": "Transfer", "debit": "Kartu Debit/Kredit"}

class PosItem(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    quantity: int = Field(ge=1, le=9999)
    price: Optional[int] = Field(default=None, ge=0)  # harga manual (opsional), mis. sayur timbang

class PosSaleInput(BaseModel):
    items: List[PosItem] = Field(min_length=1, max_length=200)
    payment_method: Literal["cash", "qris", "transfer", "debit"] = "cash"
    cash_received: int = Field(default=0, ge=0)
    discount: int = Field(default=0, ge=0)
    customer_name: str = Field(default="", max_length=80)
    note: str = Field(default="", max_length=200)

def _pos_line(it: PosItem, p: dict) -> dict:
    v = None
    if p.get("variants"):
        v = next((x for x in p["variants"] if x["variant_id"] == it.variant_id), None)
        if not v:
            raise HTTPException(status_code=400, detail=f"Pilih varian untuk {p['name']}")
        disc = p.get("discount", 0)
        web = round(v["price"] * (1 - disc / 100)) if disc else v["price"]
        store = v.get("store_price") or 0
    else:
        web = p.get("final_price") or p["price"]
        store = p.get("store_price") or 0
    # Harga toko (jika diisi) jadi harga normal kasir; kosong/0 = ikut harga web (sudah termasuk diskon).
    normal = store or web
    price = normal if it.price is None else it.price
    return {"product_id": p["product_id"], "variant_id": v["variant_id"] if v else None, "variant_name": v["name"] if v else None,
            "name": p["name"], "unit": p.get("unit", ""), "quantity": it.quantity, "price": price, "normal_price": normal,
            "price_source": "toko" if store else "web",
            "hpp": (v.get("hpp", 0) if v else p.get("hpp", 0)) or 0, "line_total": price * it.quantity}

@api_router.post("/admin/pos/sales")
async def pos_create_sale(data: PosSaleInput, user=Depends(require_admin)):
    items = []
    for it in data.items:
        p = await db.products.find_one({"product_id": it.product_id, "archived": {"$ne": True}}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=400, detail="Produk tidak ditemukan")
        items.append(_pos_line(it, p))
    subtotal = sum(i["line_total"] for i in items)
    discount = min(data.discount, subtotal)
    total = subtotal - discount
    if data.payment_method == "cash" and data.cash_received < total:
        raise HTTPException(status_code=400, detail="Uang tunai kurang dari total belanja")
    if not await reserve_stock(items):
        short = []
        for i in items:
            p = await db.products.find_one({"product_id": i["product_id"]}, {"_id": 0, "stock": 1, "variants": 1})
            st = next((x.get("stock", 0) for x in p.get("variants") or [] if x["variant_id"] == i["variant_id"]), None) if i["variant_id"] else p.get("stock", 0)
            if (st or 0) < i["quantity"]:
                short.append(f"{i['name']}{' (' + i['variant_name'] + ')' if i['variant_name'] else ''} sisa {st or 0}")
        raise HTTPException(status_code=400, detail="Stok tidak cukup: " + "; ".join(short or ["periksa stok"]))
    now = datetime.now(WIB)
    sale = {"sale_id": f"KSR{now.strftime('%y%m%d')}{uuid.uuid4().hex[:5].upper()}", "channel": "kasir", "items": items,
            "subtotal": subtotal, "discount": discount, "total": total, "hpp": sum(i["hpp"] * i["quantity"] for i in items),
            "payment_method": data.payment_method, "cash_received": data.cash_received if data.payment_method == "cash" else total,
            "change": data.cash_received - total if data.payment_method == "cash" else 0,
            "customer_name": data.customer_name.strip(), "note": data.note.strip(), "status": "paid",
            "cashier": user["name"], "cashier_id": user["user_id"], "created_at": now_iso()}
    await db.pos_sales.insert_one(dict(sale))
    return sale

def _range_utc(start: str, end: str):
    s = datetime.fromisoformat(start).replace(tzinfo=WIB).astimezone(timezone.utc).isoformat()
    e = (datetime.fromisoformat(end).replace(tzinfo=WIB) + timedelta(days=1)).astimezone(timezone.utc).isoformat()
    return s, e

async def build_pos(start: str, end: str):
    s, e = _range_utc(start, end)
    sales = await db.pos_sales.find({"created_at": {"$gte": s, "$lt": e}}, {"_id": 0}).sort("created_at", -1).to_list(20000)
    paid = [x for x in sales if x["status"] == "paid"]
    prods = {}
    for x in paid:
        for i in x["items"]:
            k = f"{i['product_id']}|{i.get('variant_id') or ''}"
            p = prods.setdefault(k, {"product_id": i["product_id"], "name": i["name"] + (f" ({i['variant_name']})" if i.get("variant_name") else ""),
                                     "qty": 0, "sales": 0, "hpp": 0, "missing_hpp": False})
            p["qty"] += i["quantity"]
            p["sales"] += i["line_total"]
            p["hpp"] += i["hpp"] * i["quantity"]
            p["missing_hpp"] = p["missing_hpp"] or not i["hpp"]
    for p in prods.values():
        p["profit"] = p["sales"] - p["hpp"]
    by_pay = {}
    for x in paid:
        b = by_pay.setdefault(x["payment_method"], {"method": x["payment_method"], "label": POS_PAYMENTS.get(x["payment_method"], x["payment_method"]), "count": 0, "total": 0})
        b["count"] += 1
        b["total"] += x["total"]
    tot = {"transactions": len(paid), "voided": len(sales) - len(paid), "sales": sum(x["subtotal"] for x in paid),
           "discount": sum(x["discount"] for x in paid), "total": sum(x["total"] for x in paid), "hpp": sum(x["hpp"] for x in paid),
           "items_missing_hpp": sum(1 for p in prods.values() if p["missing_hpp"])}
    tot["gross_profit"] = tot["total"] - tot["hpp"]
    tot["margin"] = round(tot["gross_profit"] / tot["sales"] * 100, 1) if tot["sales"] else 0
    return {"start": start, "end": end, "summary": tot, "by_payment": sorted(by_pay.values(), key=lambda b: -b["total"]),
            "sales": sales, "products": sorted(prods.values(), key=lambda p: p["sales"], reverse=True)}

@api_router.get("/admin/pos/sales")
async def pos_sales(start: str, end: str, user=Depends(require_admin)):
    try:
        return await build_pos(start, end)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format tanggal YYYY-MM-DD")

@api_router.get("/admin/pos/sales/{sale_id}")
async def pos_sale_detail(sale_id: str, user=Depends(require_admin)):
    x = await db.pos_sales.find_one({"sale_id": sale_id}, {"_id": 0})
    if not x:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    return x

class PosVoid(BaseModel):
    reason: str = Field(default="", max_length=200)

@api_router.post("/admin/pos/sales/{sale_id}/void")
async def pos_void(sale_id: str, data: PosVoid, user=Depends(require_admin)):
    x = await db.pos_sales.find_one_and_update({"sale_id": sale_id, "status": "paid"}, {"$set": {
        "status": "void", "void_reason": data.reason, "voided_at": now_iso(), "voided_by": user["name"]}})
    if not x:
        raise HTTPException(status_code=400, detail="Transaksi tidak ditemukan atau sudah dibatalkan")
    await adjust_stock(x["items"], 1)
    return {"ok": True}

@api_router.get("/admin/pos/sales.xlsx")
async def pos_sales_xlsx(start: str, end: str, user=Depends(require_admin)):
    from openpyxl import Workbook
    r = await build_pos(start, end)
    s = r["summary"]
    wb = Workbook()
    ws = wb.active
    ws.title = "Ringkasan"
    for row in [[f"Laporan Penjualan Kasir Toko {STORE_NAME}"], ["Periode", f"{start} s/d {end}"], [],
                ["Jumlah transaksi", s["transactions"]], ["Transaksi dibatalkan", s["voided"]], ["Penjualan kotor", s["sales"]],
                ["Diskon", s["discount"]], ["Penjualan bersih", s["total"]], ["HPP", s["hpp"]], ["Laba kotor", s["gross_profit"]],
                ["Margin %", s["margin"]], [], ["Metode bayar", "Transaksi", "Total"]] + [[b["label"], b["count"], b["total"]] for b in r["by_payment"]]:
        ws.append(row)
    wp = wb.create_sheet("Per Produk")
    wp.append(["ID Produk", "Nama", "Qty", "Penjualan", "HPP", "Laba", "HPP belum diisi"])
    for p in r["products"]:
        wp.append([p["product_id"], p["name"], p["qty"], p["sales"], p["hpp"], p["profit"], "Ya" if p["missing_hpp"] else ""])
    wt = wb.create_sheet("Per Transaksi")
    wt.append(["No. Struk", "Tanggal", "Kasir", "Pelanggan", "Bayar", "Subtotal", "Diskon", "Total", "HPP", "Laba", "Status"])
    for x in r["sales"]:
        t = datetime.fromisoformat(x["created_at"]).astimezone(WIB).strftime("%Y-%m-%d %H:%M")
        wt.append([x["sale_id"], t, x["cashier"], x["customer_name"], POS_PAYMENTS.get(x["payment_method"], x["payment_method"]),
                   x["subtotal"], x["discount"], x["total"], x["hpp"], x["total"] - x["hpp"], "Lunas" if x["status"] == "paid" else "Dibatalkan"])
    return xlsx_response(wb, f"kasir-toko_{start}_{end}.xlsx")

@api_router.get("/admin/reports/channels")
async def channel_report(start: str, end: str, user=Depends(require_admin)):
    try:
        web, pos = await build_profit(start, end), await build_pos(start, end)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format tanggal YYYY-MM-DD")
    w, k = web["summary"], pos["summary"]
    return {"web": {"count": w["orders"], "sales": w["sales"] - w["discount"], "profit": w["gross_profit"]},
            "kasir": {"count": k["transactions"], "sales": k["total"], "profit": k["gross_profit"]}}


app.include_router(api_router)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; frame-ancestors 'none'; sandbox")
    return resp


app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ["CORS_ORIGINS"].split(",") if o.strip()],
    allow_origin_regex=os.environ["CORS_ORIGIN_REGEX"],
    allow_methods=["*"], allow_headers=["*"],
)


IMG = "https://static.prod-images.emergentagent.com/jobs/991204c2-b93d-47f7-827b-800ba8335f4e/images/"
BANNERS_SEED = [
    {"banner_id": "bn_flash", "title": "Flash Sale Hemat", "subtitle": "Diskon spesial frozen food pilihan hari ini",
     "cta_label": "Lihat Flash Sale", "link": "#flash-sale", "theme": "dark", "active": True, "order": 1,
     "image_url": IMG + "9f80d50ff27813b9a1fb233a6d024bd21e9a69013db4281e4a2be4bc115a821f.jpeg"},
    {"banner_id": "bn_ongkir", "title": "Gratis Ongkir", "subtitle": "Belanja min. Rp100.000 atau pakai voucher ONGKIRGRATIS",
     "cta_label": "Belanja Sekarang", "link": "#all-products", "theme": "light", "active": True, "order": 2,
     "image_url": IMG + "4fafec15bd495ec39834d811ddc846e2f65d7172ccaf870b4f483c73af9b721f.jpeg"},
    {"banner_id": "bn_segar", "title": "Dari Freezer, ke Meja Makan", "subtitle": "Diantar kurir toko di Pasaman Barat, atau lewat JNE & J&T",
     "cta_label": "Belanja Sekarang", "link": "#all-products", "theme": "dark", "active": True, "order": 3,
     "image_url": IMG + "bfa17e0ad628fd97aa2581b49dde75af93acf543b3a15f91eb369a8143f50592.jpeg"},
]

@app.on_event("startup")
async def seed():
    await _seed_core()
    from catalog_sync import apply_catalog_v2, apply_cold_fix
    await apply_catalog_v2(db, logger)
    await apply_cold_fix(db, logger)

async def _seed_core():
    if await db.products.count_documents({}) == 0:
        import json
        pj = ROOT_DIR / "shopee_products.json"
        cj = ROOT_DIR / "shopee_categories.json"
        if pj.exists():
            with open(pj, encoding="utf-8") as f:
                await db.products.insert_many(json.load(f))
            if cj.exists():
                with open(cj, encoding="utf-8") as f:
                    cats = json.load(f)
                await db.categories.delete_many({})
                await db.categories.insert_many(cats)
            logger.info("Seeded products from Shopee import")
        else:
            await db.products.insert_many(build_products())
            logger.info("Seeded sample products")
    ci = ROOT_DIR / "category_images.json"
    if ci.exists():
        import json
        for slug, url in json.loads(ci.read_text()).items():
            await db.categories.update_one({"slug": slug, "image": {"$in": [None, ""]}}, {"$set": {"image": url}})
            await db.categories.update_one({"slug": slug, "image": {"$exists": False}}, {"$set": {"image": url}})
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}", "name": BRAND["adminName"],
            "email": admin_email, "password": hash_pw(os.environ["ADMIN_PASSWORD"]), "must_change_password": True,
            "role": "admin", "picture": "", "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin")
    elif not admin.get("password_changed_at") and admin.get("password") and verify_pw(os.environ["ADMIN_PASSWORD"], admin["password"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"must_change_password": True}})
    if await db.vouchers.count_documents({}) == 0:
        await db.vouchers.insert_many([dict(v) for v in VOUCHERS_SEED])
        logger.info("Seeded vouchers")
    if await db.banners.count_documents({}) == 0:
        await db.banners.insert_many([dict(b) for b in BANNERS_SEED])
        logger.info("Seeded banners")
    try:
        n = await merge_duplicate_users()
        if n:
            logger.info(f"Merged {n} duplicate accounts")
        await db.users.create_index("email", unique=True)
    except Exception as e:
        logger.error(f"User dedupe/index failed: {e}")
    await db.vouchers.update_one({"code": FIRST_ORDER_VOUCHER["code"]}, {"$setOnInsert": dict(FIRST_ORDER_VOUCHER)}, upsert=True)
    await db.vouchers.update_one({"code": "ONGKIR10"}, {"$setOnInsert": {
        "code": "ONGKIR10", "type": "shipping_discount", "value": 10000, "max_discount": 10000, "min_purchase": 150000,
        "description": "Diskon ongkir Rp10.000, min belanja Rp150.000", "active": True}}, upsert=True)
    if not await db.settings.find_one({"key": "migr_ongkirgratis_off"}):
        await db.vouchers.update_one({"code": "ONGKIRGRATIS"}, {"$set": {"active": False}})
        await db.settings.insert_one({"key": "migr_ongkirgratis_off", "at": now_iso()})
    if not await db.settings.find_one({"key": "migr_belanjapertama_110k"}):
        await db.vouchers.update_one({"code": FIRST_ORDER_VOUCHER["code"]}, {"$set": {
            "min_purchase": FIRST_ORDER_VOUCHER["min_purchase"], "description": FIRST_ORDER_VOUCHER["description"]}})
        await db.settings.insert_one({"key": "migr_belanjapertama_110k", "at": now_iso()})
    if not await db.settings.find_one({"key": "migr_commission_wallet"}):
        await migrate_commission_wallet()
        await db.settings.insert_one({"key": "migr_commission_wallet", "at": now_iso()})
    try:
        await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
        await db.login_attempts.create_index("identifier")
        await db.flash_wa_runs.create_index("date", unique=True)
        await db.pos_sales.create_index("sale_id", unique=True)
        await db.pos_sales.create_index("created_at")
        await db.commission_tx.create_index([("user_id", 1), ("created_at", -1)])
        await db.refund_transfers.create_index("refund_id", unique=True)
        await db.refund_transfers.create_index([("user_id", 1), ("created_at", -1)])
        await db.withdrawals.create_index("user_id", unique=True, name="one_pending_withdrawal",
                                          partialFilterExpression={"status": "pending"})
    except Exception as e:
        logger.error(f"Index creation failed: {e}")
    try:
        init_storage()
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
