from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from django.conf import settings

bearer_scheme = HTTPBearer()

# Depende del token tipo Bearer en la cabecera Authorization
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    token = credentials.credentials
    secret_key = getattr(settings, "JWT_SECRET_KEY", settings.SECRET_KEY)
    algorithm = getattr(settings, "JWT_ALGORITHM", "HS256")
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload
