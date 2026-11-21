import { useEffect, useRef, useState } from "react";

export const FlyToCart = ({ targetRef }) => {
  const [flights, setFlights] = useState([]);
  const origin = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  useEffect(() => {
    const down = (e) => { origin.current = { x: e.clientX, y: e.clientY }; };
    const add = (e) => {
      const t = targetRef.current?.getBoundingClientRect();
      if (!t) return;
      const id = Date.now() + Math.random();
      setFlights((f) => [...f, { id, img: e.detail?.image, from: origin.current, to: { x: t.left + t.width / 2, y: t.top + t.height / 2 }, go: false }]);
      requestAnimationFrame(() => requestAnimationFrame(() => setFlights((f) => f.map((x) => (x.id === id ? { ...x, go: true } : x)))));
      setTimeout(() => {
        setFlights((f) => f.filter((x) => x.id !== id));
        targetRef.current?.animate([{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }], { duration: 350 });
      }, 700);
    };
    document.addEventListener("pointerdown", down, true);
    window.addEventListener("cart:add", add);
    return () => { document.removeEventListener("pointerdown", down, true); window.removeEventListener("cart:add", add); };
  }, [targetRef]);
  return flights.map((f) => (
    <img key={f.id} src={f.img} alt="" aria-hidden data-testid="fly-to-cart"
      className="fixed z-[100] w-14 h-14 rounded-full object-cover shadow-xl border-2 border-white pointer-events-none"
      style={{ left: (f.go ? f.to.x : f.from.x) - 28, top: (f.go ? f.to.y : f.from.y) - 28, opacity: f.go ? 0.3 : 1,
        transform: f.go ? "scale(0.35)" : "scale(1)", transition: "left 0.65s cubic-bezier(.5,-0.3,.7,1), top 0.65s cubic-bezier(.3,.6,.4,1), transform 0.65s ease-in, opacity 0.65s ease-in" }} />
  ));
};
