# giga-Portal — GigaNexus 員工入口網

集團員工的單一入口(Gateway 子路徑 `/`):登入、個人資訊、待辦與簽核、常用功能、公告與行程,並可切換到有權限的其他應用(IT 管理系統…)。登入與權限由 Gateway BFF 提供,權限由 GigaItApp 設定;風格為淺綠 / 科技綠,可切換玻璃 / 扁平。

| 文件 | 內容 |
| --- | --- |
| [AGENT.md](AGENT.md) | AI 協作準則(含從 GigaItApp 複製框架的規則) |
| [docs/PRD.md](docs/PRD.md) | 產品需求(v0.1.2 草案):決策、功能、配合修改、待決事項、進度 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架構、請求與權限流程、風格切換、部署 |
| [docs/API.md](docs/API.md) | portal-api 端點(草案)與使用的 BFF API |
| [docs/UI-GUIDE.md](docs/UI-GUIDE.md) | 綠能色盤、玻璃 / 扁平、版面 |
| [docs/PROJECT-MAP.md](docs/PROJECT-MAP.md) | 專案地圖(規劃) |
| [docs/Gherkin/](docs/Gherkin/README.md) | 驗收場景 |

- 上位規範與跨專案規則:`../giga-api-gateway-bff/`(`AGENT.md` §10、`docs/`)
- 狀態:**M1 進行中**:`frontend/` 框架已建立並發佈到本機 Nginx(`https://localhost/`);portal-api 自 M4 開始
- 本機開發:`cd frontend && npm install && npm run dev`(http://localhost:5179/,需本機 Gateway 與兄弟目錄 `../giga-api-gateway-bff`);權限代碼 `sh deploy/apply-gateway-dev-rbac.sh`;發佈 `docker compose -f deploy/docker-compose.yml run --rm --build spa-portal`
