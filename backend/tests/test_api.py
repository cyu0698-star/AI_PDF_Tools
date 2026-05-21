"""
测试 Gemini API 连接
运行: python tests/test_api.py
"""
import os
from dotenv import load_dotenv

load_dotenv()

# 配置代理
http_proxy = os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY")
if http_proxy:
    os.environ["HTTP_PROXY"] = http_proxy
    os.environ["HTTPS_PROXY"] = http_proxy
    print(f"[代理] 使用代理: {http_proxy}")

from google import genai

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ 错误: GEMINI_API_KEY 未配置")
    print("请创建 .env 文件并设置 GEMINI_API_KEY=your_api_key")
    exit(1)

print("=== Gemini API 测试 ===\n")

client = genai.Client(api_key=api_key)

print("正在测试 API 连接...\n")

try:
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents="Explain how AI works in a few words",
    )
    
    print("✅ API 调用成功！")
    print("\n--- API 响应 ---")
    print(response.text)
    print("----------------")
    print("\n🎉 Gemini API 工作正常！")
    
except Exception as e:
    print(f"❌ API 调用失败: {e}")
