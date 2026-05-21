# YoloFarm AI Forecast

Module này dùng package layout `src.*`, ví dụ `from src.config import settings`.

## Cách chạy đúng

- Khi chạy bằng `pnpm dev`, script root chạy FastAPI từ `server/AI_feature` và thêm `ai-forecast` vào `sys.path`, nên import `src.*` hoạt động.
- Khi chạy riêng trong thư mục `server/AI_feature/ai-forecast`, hãy chạy theo module hoặc đảm bảo thư mục hiện tại nằm trong `PYTHONPATH`.

Ví dụ kiểm tra import:

```powershell
..\..\..\.venv\Scripts\python.exe -c "import sys; sys.path.insert(0, '.'); import src.config; import src.model.train"
```

File `pyrightconfig.json` trong thư mục này cấu hình Pylance/Pyright để không suy luận nhầm import root là `src` và báo lỗi `Cannot find module src.config`.
