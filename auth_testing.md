# Auth Testing Playbook (Emergent Google Auth + JWT)

## JWT email/password
- Register: POST /api/auth/register {name,email,password}
- Login: POST /api/auth/login {email,password} -> returns {token, user}
- Use header Authorization: Bearer <token> OR cookie session_token

## Emergent Google Auth
Create test user & session:
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({user_id: userId, email: 'test.user.'+Date.now()+'@example.com', name:'Test User', role:'customer', created_at:new Date()});
db.user_sessions.insertOne({user_id: userId, session_token: sessionToken, expires_at: new Date(Date.now()+7*24*60*60*1000), created_at:new Date()});
print('Session token: ' + sessionToken);
"
```
Test: curl GET /api/auth/me -H "Authorization: Bearer <token_or_session>"

## Admin
- Admin dibuat saat startup dari ADMIN_EMAIL / ADMIN_PASSWORD di backend/.env (role=admin)
