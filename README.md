# 自习室座位预约系统

数据库系统概论课程设计项目。基于 MySQL + Flask 的 Web 端自习室座位预约管理平台。

## 功能

- **座位地图**：按楼栋→自习室→座位浏览，日期+时段筛选，颜色区分空闲/占用/维护状态
- **预约签到**：SELECT ... FOR UPDATE 行级锁防并发抢座，15分钟内签到确认
- **信用管理**：缺席扣分（默认100分，缺席扣10分，低于60分禁止预约）
- **管理后台**：自习室/座位增删，座位维护状态切换，违约记录查看
- **数据统计**：时段利用率、热门座位排行、学生信用排行
- **自动处理**：MySQL 事件调度器每5分钟扫描超时预约，自动标记缺席

## 技术栈

| 层 | 技术 |
|---|---|
| 数据库 | MySQL 8.0 (InnoDB) |
| 后端 | Python Flask 3.x |
| 数据库驱动 | PyMySQL |
| 前端 | 原生 HTML/CSS/JS + Jinja2 模板 |
| 密码加密 | bcrypt (12轮加盐) |

## 数据库设计

- **7 张表**：user, building, room, seat, time_slot, reservation, violation
- **4 个视图**：座位可用性、时段利用率、热门座位、信用排行
- **3 个存储过程**：预约、签到、取消
- **2 个数据库事件**：每5分钟扫描超时、每天自动完成
- **3 个复合索引**：加速座位查询、个人预约查询、状态筛选

## 快速开始

### 1. 环境要求

- Python 3.10+
- MySQL 8.0+

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置数据库

```bash
# 复制配置文件
cp config.example.py config.py

# 编辑 config.py，填入你的 MySQL 密码
```

### 4. 导入数据库

```bash
mysql -u root -p < db.sql
```

### 5. 启动应用

```bash
python app.py
```

访问 http://localhost:5000

### 6. 默认管理员账号

- 用户名：`admin`
- 密码：`admin123`

## 项目结构

```
seat-reservation/
├── app.py                  # Flask 主入口
├── config.example.py       # 配置文件模板
├── db.sql                  # 数据库建表 + 存储过程 + 视图 + 初始化数据
├── requirements.txt        # Python 依赖
├── models/
│   └── db.py               # 数据库连接与查询封装
├── controllers/
│   ├── auth.py             # 登录/注册
│   ├── seat.py             # 座位地图/预约/签到/统计
│   └── admin.py            # 管理后台
├── templates/
│   ├── base.html           # 基础布局
│   ├── login.html / register.html
│   ├── index.html          # 座位地图
│   ├── my_reservations.html
│   ├── admin.html
│   └── stats.html
├── static/
│   ├── css/style.css       # 全局样式
│   └── js/main.js
└── report/
    └── 课程设计报告.md
```

## 课程设计报告

详见 `report/课程设计报告.md`，包含完整的六章结构：
一、系统定义 → 二、需求分析 → 三、系统设计 → 四、详细设计 → 五、实现与测试 → 六、总结

## 许可证

本项目仅供学习交流使用。
