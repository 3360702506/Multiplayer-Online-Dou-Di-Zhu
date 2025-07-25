from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import logging

from routes import router

# 配置日志
logging.basicConfig(level=logging.INFO)

app = FastAPI()

# 添加路由
app.include_router(router)

# 挂载静态文件目录应该在所有其他路由之后
app.mount("/", StaticFiles(directory="../frontend", html=True), name="static")
