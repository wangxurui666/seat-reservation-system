const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat
} = require('docx');

// ============================================================
// Helper functions
// ============================================================

const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
const headerShading = { fill: "1A3C34", type: ShadingType.CLEAR };
const altShading = { fill: "F7F4EB", type: ShadingType.CLEAR };

function p(text, opts = {}) {
  const runs = [];
  if (typeof text === 'string') {
    runs.push(new TextRun({ text, bold: opts.bold, size: opts.size || 22, font: opts.font, color: opts.color, italics: opts.italics }));
  } else if (Array.isArray(text)) {
    text.forEach(t => {
      if (typeof t === 'string') runs.push(new TextRun({ text: t, size: 22 }));
      else runs.push(new TextRun(t));
    });
  }
  return new Paragraph({
    spacing: { after: opts.after !== undefined ? opts.after : 120, line: 360 },
    alignment: opts.alignment,
    children: runs,
    ...(opts.pageBreakBefore ? { pageBreakBefore: true } : {}),
  });
}

function heading(text, level) {
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    spacing: { before: level === 1 ? 400 : 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: level === 1 ? 32 : 28, font: "Microsoft YaHei" })],
  });
}

function subHeading(text) {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, font: "Microsoft YaHei" })],
  });
}

function tableRow(cells, isHeader = false, widths = null) {
  return new TableRow({
    children: cells.map((cell, i) => new TableCell({
      borders,
      width: widths ? { size: widths[i], type: WidthType.DXA } : undefined,
      shading: isHeader ? headerShading : undefined,
      margins: cellMargins,
      children: [new Paragraph({
        spacing: { after: 0, line: 300 },
        children: [new TextRun({
          text: String(cell),
          size: isHeader ? 20 : 20,
          bold: isHeader,
          color: isHeader ? "FFFFFF" : "2C2420",
          font: "Microsoft YaHei",
        })],
      })],
    })),
  });
}

function codeBlock(codeText) {
  const lines = codeText.split('\n');
  return lines.map(line => new Paragraph({
    spacing: { after: 0, line: 280 },
    shading: { fill: "F0F0F0", type: ShadingType.CLEAR },
    indent: { left: 360 },
    children: [new TextRun({ text: line || ' ', size: 18, font: "Consolas", color: "333333" })],
  }));
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 60, line: 340 },
    children: [new TextRun({ text, size: 22, font: "Microsoft YaHei" })],
  });
}

function numberedBullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { after: 60, line: 340 },
    children: [new TextRun({ text, size: 22, font: "Microsoft YaHei" })],
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 0 }, children: [] });
}

// ============================================================
// Document Content
// ============================================================

const children = [];

// ---- COVER PAGE ----
children.push(emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine());
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: "数据库系统概论", size: 36, bold: true, font: "Microsoft YaHei", color: "1A3C34" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 600 },
  children: [new TextRun({ text: "课程设计报告", size: 52, bold: true, font: "Microsoft YaHei", color: "1A3C34" })],
}));
children.push(emptyLine());
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 120 },
  children: [new TextRun({ text: "自习室座位预约系统", size: 40, font: "Microsoft YaHei", color: "C4933C" })],
}));
children.push(emptyLine(), emptyLine(), emptyLine());
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: "学院：_____________", size: 24, font: "Microsoft YaHei" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: "专业：_____________", size: 24, font: "Microsoft YaHei" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: "学号：_____________", size: 24, font: "Microsoft YaHei" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: "姓名：_____________", size: 24, font: "Microsoft YaHei" })],
}));
children.push(emptyLine(), emptyLine());
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: "2026年6月", size: 24, font: "Microsoft YaHei" })],
}));

// ---- PAGE BREAK: TOC ----
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- CHAPTER 1: 系统定义 ----
children.push(heading("一、系统定义", 1));

children.push(subHeading("1. 系统定义"));
children.push(p("本系统是一个基于 Web 的自习室/图书馆座位预约管理平台，旨在解决高校自习座位资源紧张、占座现象普遍的问题。系统为在校学生提供在线浏览、预约、签到自习座位的完整服务，并为管理员提供自习室与座位的管理功能。"));
children.push(p("核心价值：通过引入"预约—签到—信用"闭环机制和数据库层面的并发控制，确保座位资源的公平分配和高效利用。"));

children.push(subHeading("2. 系统说明"));
children.push(p("目标用户：", { bold: true }));
children.push(bullet("学生用户：注册后可浏览座位地图，按日期和时段预约空闲座位，并按时签到使用"));
children.push(bullet("管理员用户：可管理自习室和座位信息，查看违约记录和统计数据"));

children.push(p("核心业务流程：", { bold: true }));
children.push(numberedBullet("注册与登录：用户填写用户名、密码、真实姓名和学号完成注册，登录后进入系统"));
children.push(numberedBullet("浏览座位：按楼栋 → 自习室 → 座位三个层次查看，选择日期和时段后实时显示各座位可用状态"));
children.push(numberedBullet("预约座位：点击空闲座位的"预约"按钮，系统通过数据库行级锁（SELECT ... FOR UPDATE）确保同一座位同一时段仅一人预约成功"));
children.push(numberedBullet("签到确认：预约成功后需在 15 分钟内在线签到，超时未签到则自动标记为"缺席""));
children.push(numberedBullet("信用管理：缺席一次扣除 10 分信用分，信用分低于 60 分则禁止继续预约"));
children.push(numberedBullet("统计查看：所有用户可查看时段利用率、热门座位排行和信用排行"));
children.push(numberedBullet("管理后台：管理员可增删自习室和座位，查看违约记录"));

children.push(p("技术特点：", { bold: true }));

const techChildren = [
  tableRow(["特点", "说明"], true, [3000, 6360]),
  tableRow(["并发控制", "SELECT ... FOR UPDATE 行级锁防止多人同时预约同一座位"], false, [3000, 6360]),
  tableRow(["事务管理", "预约、签到等关键操作使用数据库事务保证原子性"], false, [3000, 6360]),
  tableRow(["定时任务", "MySQL 事件调度器每 5 分钟扫描超时预约并自动处理"], false, [3000, 6360]),
  tableRow(["存储过程", "3 个核心存储过程封装预约、签到、取消业务逻辑"], false, [3000, 6360]),
  tableRow(["数据库视图", "4 个视图提供不同维度的统计数据"], false, [3000, 6360]),
  tableRow(["索引优化", "复合索引加速座位可用性查询和个人预约查询"], false, [3000, 6360]),
  tableRow(["密码安全", "bcrypt 哈希加密，12 轮加盐"], false, [3000, 6360]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3000, 6360], rows: techChildren }));

// ---- CHAPTER 2: 需求分析 ----
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("二、需求分析", 1));

children.push(subHeading("1. 需求分析"));
children.push(p("1.1 功能需求", { bold: true }));

const funcChildren = [
  tableRow(["模块", "功能点", "详细描述"], true, [1800, 2000, 5560]),
  tableRow(["用户管理", "注册", "填写用户名、密码、真实姓名、学号，检查用户名和学号唯一性"], false, [1800, 2000, 5560]),
  tableRow(["", "登录/登出", "bcrypt 密码验证，Flask session 管理登录状态"], false, [1800, 2000, 5560]),
  tableRow(["", "角色区分", "student（学生）和 admin（管理员）两种角色，路由级权限控制"], false, [1800, 2000, 5560]),
  tableRow(["座位浏览", "楼栋选择", "3 栋楼（图书馆主馆、教学楼A座、综合学习中心）"], false, [1800, 2000, 5560]),
  tableRow(["", "自习室浏览", "5 个自习室，显示楼层、容量等基本信息"], false, [1800, 2000, 5560]),
  tableRow(["", "座位地图", "每个自习室按 10 列网格展示全部座位"], false, [1800, 2000, 5560]),
  tableRow(["", "日期时段筛选", "日期选择器 + 7 个时段下拉框"], false, [1800, 2000, 5560]),
  tableRow(["", "状态标识", "绿色=可预约，红色=已占用，灰色=维护中，图标标注电源/靠窗"], false, [1800, 2000, 5560]),
  tableRow(["预约管理", "预约座位", "检查信用分、座位状态、并发冲突后创建预约"], false, [1800, 2000, 5560]),
  tableRow(["", "签到", "15 分钟内确认到达，自动更新状态"], false, [1800, 2000, 5560]),
  tableRow(["", "取消预约", "仅可取消"已预约"状态的记录"], false, [1800, 2000, 5560]),
  tableRow(["", "超时处理", "超过 15 分钟未签到自动标记缺席并扣分"], false, [1800, 2000, 5560]),
  tableRow(["信用管理", "信用分", "默认 100 分，缺席扣 10 分"], false, [1800, 2000, 5560]),
  tableRow(["", "预约限制", "信用分低于 60 分禁止预约"], false, [1800, 2000, 5560]),
  tableRow(["", "违约记录", "每次缺席自动生成违约记录并关联扣分"], false, [1800, 2000, 5560]),
  tableRow(["数据统计", "时段利用率", "近 30 天各时段预约数和使用率"], false, [1800, 2000, 5560]),
  tableRow(["", "热门座位", "近 30 天被预约次数最多的座位 Top 20"], false, [1800, 2000, 5560]),
  tableRow(["", "信用排行", "所有学生信用分排序，含缺席次数"], false, [1800, 2000, 5560]),
  tableRow(["管理后台", "自习室管理", "添加新的自习室（楼栋、名称、楼层、容量）"], false, [1800, 2000, 5560]),
  tableRow(["", "座位管理", "添加、删除座位，切换座位维护/可用状态"], false, [1800, 2000, 5560]),
  tableRow(["", "违约查看", "查看最近 50 条违约记录"], false, [1800, 2000, 5560]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [1800, 2000, 5560], rows: funcChildren }));

children.push(p("1.2 非功能需求", { bold: true }));
const nfChildren = [
  tableRow(["类型", "要求", "实现方式"], true, [2000, 3700, 3660]),
  tableRow(["并发安全", "同一座位同时段仅一人预约成功", "InnoDB 行级锁 + 事务"], false, [2000, 3700, 3660]),
  tableRow(["数据一致性", "预约相关操作原子性", "手动事务管理（commit/rollback）"], false, [2000, 3700, 3660]),
  tableRow(["查询效率", "常用查询响应 < 100ms", "3 个复合索引"], false, [2000, 3700, 3660]),
  tableRow(["数据完整性", "实体、参照、用户定义完整性", "主键、外键、ENUM、UNIQUE 约束"], false, [2000, 3700, 3660]),
  tableRow(["安全性", "密码不可逆存储", "bcrypt 哈希 12 轮加盐"], false, [2000, 3700, 3660]),
  tableRow(["可维护性", "业务逻辑清晰分层", "MVC 架构（Flask 蓝图 + 独立模板）"], false, [2000, 3700, 3660]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2000, 3700, 3660], rows: nfChildren }));

children.push(subHeading("2. 系统逻辑模型"));
children.push(p("2.1 数据流图（DFD）", { bold: true }));
children.push(p("顶层数据流图："));
children.push(p("用户 → 注册/登录 → 系统 ← 查看统计 ← 管理员"));
children.push(p("  ↓                  ↓"));
children.push(p("预约座位            管理座位"));
children.push(p("  ↓                  ↓"));
children.push(p("签到确认            处理违约"));

children.push(p("一级细化 — 预约流程："));
children.push(p("学生 → [选择日期+时段] → [浏览可用座位] → [点击预约]"));
children.push(p("  ↓ 检查信用分 ≥ 60?"));
children.push(p("  ↓ SELECT ... FOR UPDATE 检查冲突"));
children.push(p("  ├─ 有冲突 → ROLLBACK → "已被他人预约""));
children.push(p("  └─ 无冲突 → INSERT → COMMIT → "预约成功""));

children.push(p("2.2 数据字典", { bold: true }));
const dictChildren = [
  tableRow(["数据项", "类型", "取值范围", "说明"], true, [1800, 1800, 2700, 3060]),
  tableRow(["用户ID", "INT", "自增正整数", "唯一标识，主键"], false, [1800, 1800, 2700, 3060]),
  tableRow(["用户名", "VARCHAR(50)", "字母数字组合", "唯一，用于登录"], false, [1800, 1800, 2700, 3060]),
  tableRow(["密码", "VARCHAR(255)", "bcrypt 哈希", "不可逆加密"], false, [1800, 1800, 2700, 3060]),
  tableRow(["信用分", "INT", "0-100，默认100", "低于60禁止预约"], false, [1800, 1800, 2700, 3060]),
  tableRow(["角色", "ENUM", "student, admin", "控制权限"], false, [1800, 1800, 2700, 3060]),
  tableRow(["座位标签", "VARCHAR(20)", '如"A-01"', "自习室内部编号"], false, [1800, 1800, 2700, 3060]),
  tableRow(["座位状态", "ENUM", "available, maintenance", "维护中不可预约"], false, [1800, 1800, 2700, 3060]),
  tableRow(["预约状态", "ENUM", "5种状态", "reserved/checked_in/completed/cancelled/absent"], false, [1800, 1800, 2700, 3060]),
  tableRow(["时间段", "TIME", "08:00-22:00", "每天7个时段，每段2小时"], false, [1800, 1800, 2700, 3060]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [1800, 1800, 2700, 3060], rows: dictChildren }));

// ---- CHAPTER 3: 系统设计 ----
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("三、系统设计", 1));

children.push(subHeading("1. 概念结构设计（E-R 模型）"));

children.push(p("1.1 实体及其属性", { bold: true }));
children.push(p("用户（User）：{ id, username, password, real_name, student_id, credit, role, created_at }"));
children.push(p("楼栋（Building）：{ id, name, location }"));
children.push(p("自习室（Room）：{ id, name, floor, capacity, description }"));
children.push(p("座位（Seat）：{ id, seat_label, has_power, near_window, status }"));
children.push(p("时间段（TimeSlot）：{ id, slot_name, start_time, end_time }"));
children.push(p("预约（Reservation）：{ id, reserve_date, status, created_at, checked_in_at }"));
children.push(p("违约记录（Violation）：{ id, reason, points_deducted, created_at }"));

children.push(p("1.2 实体间联系", { bold: true }));
const relChildren = [
  tableRow(["联系名", "参与实体", "联系类型", "说明"], true, [1800, 2700, 1260, 3600]),
  tableRow(["位于", "楼栋 — 自习室", "1:N", "一个楼栋包含多个自习室"], false, [1800, 2700, 1260, 3600]),
  tableRow(["容纳", "自习室 — 座位", "1:N", "一个自习室包含多个座位"], false, [1800, 2700, 1260, 3600]),
  tableRow(["预约座位", "用户 — 座位", "M:N（通过预约）", "一个用户可预约多个座位，一个座位可被多用户分时段预约"], false, [1800, 2700, 1260, 3600]),
  tableRow(["按时段", "预约 — 时间段", "N:1", "每条预约属于一个时段"], false, [1800, 2700, 1260, 3600]),
  tableRow(["产生", "预约 — 违约记录", "1:1", "一次缺席产生一条违约记录"], false, [1800, 2700, 1260, 3600]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [1800, 2700, 1260, 3600], rows: relChildren }));

children.push(p("1.3 E-R 图", { bold: true }));
children.push(p("[楼栋] 1──N [自习室] 1──N [座位]"));
children.push(p("                          │"));
children.push(p("                          │ 1"));
children.push(p("                          │"));
children.push(p("[用户] 1──N [预约] N──1 [时间段]"));
children.push(p("                │"));
children.push(p("                │ 1"));
children.push(p("                │"));
children.push(p("            [违约记录]"));

children.push(subHeading("2. 逻辑结构设计"));
children.push(p("2.1 关系模式（7 张表）", { bold: true }));

children.push(p("① user（用户表）", { bold: true }));
children.push(...codeBlock(`user(id INT PRIMARY KEY AUTO_INCREMENT,
     username VARCHAR(50) NOT NULL UNIQUE,
     password VARCHAR(255) NOT NULL,
     real_name VARCHAR(50) NOT NULL,
     student_id VARCHAR(20) UNIQUE,
     credit INT DEFAULT 100,
     role ENUM('student','admin') DEFAULT 'student',
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`));
children.push(p("主码：id　　候选码：username, student_id"));

children.push(p("② building（楼栋表）", { bold: true }));
children.push(...codeBlock(`building(id INT PRIMARY KEY AUTO_INCREMENT,
         name VARCHAR(100) NOT NULL,
         location VARCHAR(200))`));

children.push(p("③ room（自习室表）", { bold: true }));
children.push(...codeBlock(`room(id INT PRIMARY KEY AUTO_INCREMENT,
     building_id INT NOT NULL,
     name VARCHAR(100) NOT NULL,
     floor INT,
     capacity INT NOT NULL,
     description TEXT,
     FOREIGN KEY (building_id) REFERENCES building(id))`));

children.push(p("④ seat（座位表）", { bold: true }));
children.push(...codeBlock(`seat(id INT PRIMARY KEY AUTO_INCREMENT,
     room_id INT NOT NULL,
     seat_label VARCHAR(20) NOT NULL,
     has_power BOOLEAN DEFAULT FALSE,
     near_window BOOLEAN DEFAULT FALSE,
     status ENUM('available','maintenance') DEFAULT 'available',
     FOREIGN KEY (room_id) REFERENCES room(id),
     UNIQUE KEY uk_room_seat (room_id, seat_label))`));

children.push(p("⑤ time_slot（时间段表）", { bold: true }));
children.push(...codeBlock(`time_slot(id INT PRIMARY KEY AUTO_INCREMENT,
          slot_name VARCHAR(30) NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL)`));

children.push(p("⑥ reservation（预约表）— 核心业务表", { bold: true }));
children.push(...codeBlock(`reservation(id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            seat_id INT NOT NULL,
            reserve_date DATE NOT NULL,
            time_slot_id INT NOT NULL,
            status ENUM('reserved','checked_in','completed','cancelled','absent'),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            checked_in_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES user(id),
            FOREIGN KEY (seat_id) REFERENCES seat(id),
            FOREIGN KEY (time_slot_id) REFERENCES time_slot(id),
            INDEX idx_seat_date_slot (seat_id, reserve_date, time_slot_id),
            INDEX idx_user_date (user_id, reserve_date),
            INDEX idx_status (status))`));

children.push(p("⑦ violation（违约记录表）", { bold: true }));
children.push(...codeBlock(`violation(id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          reservation_id INT,
          reason VARCHAR(200),
          points_deducted INT DEFAULT 10,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES user(id),
          FOREIGN KEY (reservation_id) REFERENCES reservation(id))`));

children.push(p("2.2 范式分析", { bold: true }));
const nfParadigm = [
  tableRow(["范式", "满足情况", "说明"], true, [1500, 1200, 6660]),
  tableRow(["1NF", "✓", "所有字段均为原子值，无重复组"], false, [1500, 1200, 6660]),
  tableRow(["2NF", "✓", "非主属性完全函数依赖于主码，无部分依赖。如 reservation 中 reserve_date 完全依赖于 (id)，而非部分依赖于其他候选码"], false, [1500, 1200, 6660]),
  tableRow(["3NF", "✓", "不存在传递函数依赖。如 violation 表中 points_deducted 直接依赖于主码 id，而非通过其他非主属性间接依赖"], false, [1500, 1200, 6660]),
  tableRow(["BCNF", "✓", "所有决定因素都是候选码。reservation 表中 (seat_id, reserve_date, time_slot_id) 组合可唯一确定一条有效预约记录"], false, [1500, 1200, 6660]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [1500, 1200, 6660], rows: nfParadigm }));

children.push(p("2.3 索引设计", { bold: true }));
const idxChildren = [
  tableRow(["索引名", "表", "字段", "类型", "用途"], true, [2000, 1600, 2800, 1400, 1560]),
  tableRow(["PRIMARY", "所有表", "id", "聚簇索引", "主键快速定位"], false, [2000, 1600, 2800, 1400, 1560]),
  tableRow(["idx_seat_date_slot", "reservation", "(seat_id, reserve_date, time_slot_id)", "复合索引", "座位可用性查询"], false, [2000, 1600, 2800, 1400, 1560]),
  tableRow(["idx_user_date", "reservation", "(user_id, reserve_date)", "复合索引", ""我的预约"查询"], false, [2000, 1600, 2800, 1400, 1560]),
  tableRow(["idx_status", "reservation", "(status)", "单列索引", "事件调度器扫描超时预约"], false, [2000, 1600, 2800, 1400, 1560]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2000, 1600, 2800, 1400, 1560], rows: idxChildren }));

children.push(subHeading("3. 系统功能模块图"));
children.push(p("自习室座位预约系统"));
children.push(p("├── 用户模块"));
children.push(p("│   ├── 注册"));
children.push(p("│   ├── 登录"));
children.push(p("│   ├── 登出"));
children.push(p("│   └── Session验证"));
children.push(p("├── 座位预约模块"));
children.push(p("│   ├── 浏览座位"));
children.push(p("│   ├── 预约座位"));
children.push(p("│   ├── 签到"));
children.push(p("│   └── 取消预约"));
children.push(p("├── 信用模块"));
children.push(p("│   ├── 信用分查询"));
children.push(p("│   ├── 违约记录"));
children.push(p("│   └── 超时自动扣分"));
children.push(p("├── 管理后台模块"));
children.push(p("│   ├── 自习室增删"));
children.push(p("│   ├── 座位增删/状态切换"));
children.push(p("│   └── 违约记录查看"));
children.push(p("└── 数据统计模块"));
children.push(p("    ├── 时段利用率"));
children.push(p("    ├── 热门座位排行"));
children.push(p("    └── 信用排行"));

children.push(subHeading("4. 其他设计图形工具"));
children.push(p("4.1 系统架构图", { bold: true }));
children.push(p("浏览器 (HTML/CSS/JS + Jinja2 Templates)"));
children.push(p("    │ HTTP"));
children.push(p("Flask Web 应用层"));
children.push(p("    ├── auth.py (登录/注册/登出)"));
children.push(p("    ├── seat.py (预约/签到/取消/统计)"));
children.push(p("    ├── admin.py (管理后台)"));
children.push(p("    └── models/db.py (数据访问层, PyMySQL)"));
children.push(p("    │ TCP/3306"));
children.push(p("MySQL 8.0 数据库层"));
children.push(p("    ├── 表 ×7"));
children.push(p("    ├── 视图 ×4"));
children.push(p("    ├── 存储过程 ×3"));
children.push(p("    ├── 事件调度器 ×2"));
children.push(p("    └── 索引 ×3"));

children.push(p("4.2 预约状态转换图", { bold: true }));
children.push(p("[reserved] 已预约，待签到"));
children.push(p("    ├── 15min内签到 → [checked_in] 已签到 → 时段结束 → [completed] 已完成"));
children.push(p("    ├── 取消预约 → [cancelled] 已取消"));
children.push(p("    └── 超时未签到 → [absent] 缺席 → 扣除10分 → [violation] 违约记录"));

// ---- CHAPTER 4: 详细设计 ----
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("四、详细设计", 1));

children.push(subHeading("4.1 数据库对象详细设计"));
children.push(p("4.1.1 存储过程", { bold: true }));

children.push(p("sp_create_reservation — 预约座位", { bold: true, italics: true }));
children.push(...codeBlock(`CREATE PROCEDURE sp_create_reservation(
    IN  p_user_id INT, IN  p_seat_id INT,
    IN  p_reserve_date DATE, IN  p_time_slot_id INT,
    OUT p_result INT, OUT p_message VARCHAR(100))
BEGIN
    START TRANSACTION;
    -- Step 1: 验证信用分 >= 60
    SELECT credit INTO v_credit FROM user WHERE id = p_user_id;
    IF v_credit < 60 THEN ROLLBACK; -- 信用不足
    -- Step 2: 验证座位状态（非 maintenance）
    -- Step 3: SELECT ... FOR UPDATE 加行锁检查冲突
    -- Step 4: 无冲突则 INSERT, COMMIT
    --       有冲突则 ROLLBACK
END`));

children.push(p("sp_check_in — 签到", { bold: true, italics: true }));
children.push(...codeBlock(`CREATE PROCEDURE sp_check_in(
    IN  p_reservation_id INT, IN  p_user_id INT,
    OUT p_result INT, OUT p_message VARCHAR(100))
BEGIN
    -- 1. 验证预约归属（是否为本人）
    -- 2. 验证状态（必须为 'reserved'）
    -- 3. 检查是否超时（15分钟窗口）
    -- 4. 未超时 → UPDATE status = 'checked_in'
    -- 5. 已超时 → 标记absent + 插入violation + credit-10
END`));

children.push(p("sp_cancel_reservation — 取消预约", { bold: true, italics: true }));
children.push(...codeBlock(`CREATE PROCEDURE sp_cancel_reservation(
    IN  p_reservation_id INT, IN  p_user_id INT,
    OUT p_result INT, OUT p_message VARCHAR(100))
BEGIN
    -- 1. 验证预约归属（是否为本人）
    -- 2. 验证状态（必须为 'reserved'）
    -- 3. UPDATE status = 'cancelled'
END`));

children.push(p("4.1.2 数据库事件（定时任务）", { bold: true }));
children.push(p("evt_auto_mark_absent — 超时自动标记（每5分钟）", { bold: true }));
children.push(p("扫描所有 status='reserved' 且距创建时间超过 15 分钟的预约记录，逐条标记为 'absent'，插入违约记录，扣除用户信用分 10 分（最低 0 分）。使用游标逐条处理。"));

children.push(p("evt_complete_reservations — 自动完成（每天）", { bold: true }));
children.push(p("将 status='checked_in' 且 reserve_date < 今天的预约记录批量更新为 'completed'。"));

children.push(p("4.1.3 数据库视图", { bold: true }));
const viewChildren = [
  tableRow(["视图名", "SQL 核心逻辑", "用途"], true, [2400, 4000, 2960]),
  tableRow(["v_seat_availability", "seat CROSS JOIN time_slot LEFT JOIN reservation ON ... status IN ('reserved','checked_in')", "笛卡尔积 + 左连接，展示每个座位在所有时段的占用情况"], false, [2400, 4000, 2960]),
  tableRow(["v_slot_usage_stats", "time_slot LEFT JOIN reservation ... WHERE reserve_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ... GROUP BY slot_id", "按时间段分组统计近30天利用率，按利用率降序"], false, [2400, 4000, 2960]),
  tableRow(["v_seat_popularity", "seat → room → building LEFT JOIN reservation ... GROUP BY seat_id ORDER BY COUNT(r.id) DESC", "三表连接 + 聚合，按预约次数降序排列"], false, [2400, 4000, 2960]),
  tableRow(["v_user_credit_ranking", "user LEFT JOIN reservation ... WHERE role='student' GROUP BY user_id ORDER BY credit DESC", "学生信用排名，含总预约数和缺席数"], false, [2400, 4000, 2960]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2400, 4000, 2960], rows: viewChildren }));

children.push(p("4.1.4 应用层数据库访问设计", { bold: true }));
children.push(p("由于 PyMySQL 对存储过程的 OUT 参数支持不稳定，应用层实际采用直接 SQL + Python 手动事务管理："));
children.push(...codeBlock(`# 预约流程（controllers/seat.py）
conn = get_db()
try:
    with conn.cursor() as cur:
        # 1. 检查信用分
        cur.execute('SELECT credit FROM user WHERE id = %s', (user_id,))
        # 2. 检查座位状态
        cur.execute('SELECT status FROM seat WHERE id = %s', (seat_id,))
        # 3. 行级锁检查冲突
        cur.execute('''SELECT id FROM reservation WHERE seat_id = %s
            AND reserve_date = %s AND time_slot_id = %s
            AND status IN ('reserved', 'checked_in') FOR UPDATE''')
        if cur.fetchone():
            conn.rollback(); flash('该座位已被他人预约', 'error')
        else:
            cur.execute('INSERT INTO reservation (...) VALUES (...)')
            conn.commit(); flash('预约成功！', 'success')
except Exception as e:
    conn.rollback()`));

children.push(p("4.1.5 Session 验证机制", { bold: true }));
children.push(...codeBlock(`@app.before_request
def verify_session_user():
    """每次请求前验证 session 中的用户仍然存在"""
    if session.get('user_id'):
        user = query('SELECT id FROM user WHERE id = %s',
                     (session['user_id'],), one=True)
        if not user:
            session.clear()  # 数据库重建后自动清 session`));

children.push(p("4.1.6 权限控制设计", { bold: true }));
children.push(...codeBlock(`# 登录检查装饰器
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated

# 管理员检查装饰器
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('role') != 'admin':
            flash('需要管理员权限', 'error')
            return redirect(url_for('seat.index'))
        return f(*args, **kwargs)
    return decorated`));

// ---- CHAPTER 5: 系统实现与测试 ----
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("五、系统实现与测试", 1));

children.push(subHeading("1. 开发平台和工具选择"));

const devChildren = [
  tableRow(["类别", "选择", "版本", "选择理由"], true, [1600, 1600, 1200, 4960]),
  tableRow(["数据库", "MySQL", "8.0", "课程指定数据库，InnoDB 引擎支持事务、行锁和外键约束"], false, [1600, 1600, 1200, 4960]),
  tableRow(["后端框架", "Flask", "3.1", "Python 轻量级 Web 框架，内置 Jinja2 模板引擎，学习成本低"], false, [1600, 1600, 1200, 4960]),
  tableRow(["数据库驱动", "PyMySQL", "1.2", "纯 Python 实现，无需编译 MySQL C 扩展，兼容性好"], false, [1600, 1600, 1200, 4960]),
  tableRow(["密码加密", "bcrypt", "5.0", "安全哈希算法，自动加盐，抗彩虹表攻击"], false, [1600, 1600, 1200, 4960]),
  tableRow(["前端技术", "HTML/CSS/JS", "原生", "不引入 React/Vue 等框架，降低复杂度"], false, [1600, 1600, 1200, 4960]),
  tableRow(["字体", "Google Fonts", "—", "Playfair Display (衬线标题) + DM Sans (无衬线正文)"], false, [1600, 1600, 1200, 4960]),
  tableRow(["操作系统", "Windows 11", "—", "开发环境"], false, [1600, 1600, 1200, 4960]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [1600, 1600, 1200, 4960], rows: devChildren }));

children.push(subHeading("2. 系统测试"));
children.push(p("2.1 功能测试用例", { bold: true }));

children.push(p("用户模块", { bold: true }));
const utestChildren = [
  tableRow(["编号", "测试项", "操作步骤", "预期结果", "结果"], true, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T01", "新用户注册", "填写完整信息 → 点击注册", "提示"注册成功"，跳转登录页", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T02", "重复用户名注册", "使用已存在的用户名注册", "提示"用户名已被注册"", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T03", "必填项校验", "不填用户名直接注册", "提示"请填写所有必填字段"", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T04", "正确登录", "输入正确的用户名和密码", "跳转首页，导航栏显示用户名", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T05", "错误密码登录", "输入错误密码", "提示"用户名或密码错误"", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T06", "登出", "点击导航栏"退出"", "跳转登录页，session 清空", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T07", "Session自动失效", "数据库重建后刷新页面", "自动跳转登录页", "✓"], false, [600, 1700, 2800, 2500, 1760]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [600, 1700, 2800, 2500, 1760], rows: utestChildren }));

children.push(p("座位浏览与预约模块", { bold: true }));
const btestChildren = [
  tableRow(["编号", "测试项", "操作步骤", "预期结果", "结果"], true, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T08", "浏览座位地图", "登录后进入首页", "显示各楼栋/自习室/座位，颜色区分状态", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T09", "切换日期和时段", "选择不同日期和时段 → 点查看", "座位状态随选择刷新", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T10", "预约空闲座位", "点击绿色座位的"预约"按钮", "提示"预约成功！请在15分钟内签到"", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T11", "预约维护中座位", "点击灰色座位", "提示"该座位正在维护中"", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T12", "并发预约同一座位", "两个浏览器同时预约同一座位", "仅一人成功，另一人提示"已被他人预约"", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T13", "签到", "预约后立即在"我的预约"点签到", "提示"签到成功"，状态变为已签到", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T14", "超时签到", "预约15分钟后点签到", "提示"签到超时"，自动标记缺席并扣分", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T15", "取消预约", "在"我的预约"点取消", "确认后提示"取消成功"，座位恢复可用", "✓"], false, [600, 1700, 2800, 2500, 1760]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [600, 1700, 2800, 2500, 1760], rows: btestChildren }));

children.push(p("信用与统计模块", { bold: true }));
const ctestChildren = [
  tableRow(["编号", "测试项", "操作步骤", "预期结果", "结果"], true, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T16", "信用不足禁止预约", "将信用分手动调至 50 后预约", "提示"信用分不足，无法预约"", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T17", "缺席自动扣分", "预约超时未签到", "信用分 -10，违约记录新增一条", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T18", "查看时段利用率", "导航栏点"统计"", "显示 7 个时段的利用率表格和进度条", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T19", "查看热门座位", "统计页面下拉", "显示热门座位 Top 20 排行", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T20", "查看信用排行", "统计页面下拉", "显示学生信用排行，颜色区分（绿/黄/红）", "✓"], false, [600, 1700, 2800, 2500, 1760]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [600, 1700, 2800, 2500, 1760], rows: ctestChildren }));

children.push(p("管理后台模块", { bold: true }));
const atestChildren = [
  tableRow(["编号", "测试项", "操作步骤", "预期结果", "结果"], true, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T21", "管理员访问后台", "admin 用户点"管理后台"", "显示自习室管理和违约记录", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T22", "学生无法访问后台", "普通学生访问 /admin/", "提示"需要管理员权限"，跳转首页", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T23", "添加座位", "管理员选择自习室，填座位号 → 添加", "座位列表新增一条", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T24", "切换座位状态", "管理员点"切换状态"", "座位在可用/维护间切换", "✓"], false, [600, 1700, 2800, 2500, 1760]),
  tableRow(["T25", "添加自习室", "填写自习室信息 → 添加", "新增自习室出现在列表", "✓"], false, [600, 1700, 2800, 2500, 1760]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [600, 1700, 2800, 2500, 1760], rows: atestChildren }));

children.push(p("2.2 并发测试", { bold: true }));
children.push(p("测试场景：两个用户（admin 和 wxr666）同时对同一座位（seat_id=1）、同一日期（2026-06-09）、同一时段（slot_id=1）发起预约。", { bold: true }));
children.push(p("测试结果："));
children.push(bullet("窗口 A（admin）：预约成功，提示"预约成功！请在15分钟内签到""));
children.push(bullet("窗口 B（wxr666）：预约失败，提示"该座位已被他人预约""));
children.push(p("技术原理：MySQL InnoDB 引擎的 SELECT ... FOR UPDATE 对目标行加排他锁。当第一个事务持有锁时，第二个事务必须等待。第一个事务 COMMIT 后，第二个事务的查询返回已有记录（cur.fetchone() 不为 None），触发 ROLLBACK。"));

children.push(p("2.3 数据完整性测试", { bold: true }));
const integrityChildren = [
  tableRow(["测试项", "操作", "结果"], true, [4500, 3400, 1460]),
  tableRow(["外键约束 — 删除有预约的用户", "DELETE FROM user WHERE id=1", "✗ 被外键约束阻止"], false, [4500, 3400, 1460]),
  tableRow(["外键约束 — 插入不存在的自习室ID", "INSERT INTO seat (room_id, ...) VALUES (999, ...)", "✗ 被外键约束阻止"], false, [4500, 3400, 1460]),
  tableRow(["ENUM 约束 — 非法预约状态", "INSERT INTO reservation (status, ...) VALUES ('invalid', ...)", "✗ 被 ENUM 约束阻止"], false, [4500, 3400, 1460]),
  tableRow(["UNIQUE 约束 — 同自习室重复座位号", "INSERT INTO seat (room_id, seat_label) VALUES (1, 'A-01')", "✗ 被唯一约束阻止"], false, [4500, 3400, 1460]),
  tableRow(["UNIQUE 约束 — 重复用户名", "注册已存在的用户名", "✗ 提示"用户名已被注册""], false, [4500, 3400, 1460]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4500, 3400, 1460], rows: integrityChildren }));

// ---- CHAPTER 6: 课程设计总结 ----
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("六、课程设计总结", 1));

children.push(subHeading("收获与体会"));

children.push(p("1. 数据库设计全流程实践", { bold: true }));
children.push(p("从需求分析 → 概念设计（E-R 图）→ 逻辑设计（关系模式 + 范式分析）→ 物理设计（索引 + 存储过程 + 视图），完整走通了数据库设计的标准流程。特别是对范式理论的理解不再停留在概念层面——在设计 reservation 表时，能直观感受到如果违反 3NF（如在 reservation 中冗余 room_id），会导致座位调换自习室时的大量级联更新。"));

children.push(p("2. 并发控制的真刀实枪", { bold: true }));
children.push(p(""两人同时抢一个座位"不是教科书上的空洞场景，而是真实发生的功能需求。通过 SELECT ... FOR UPDATE 解决了并发冲突，对事务的隔离级别（REPEATABLE READ）和 InnoDB 锁机制（行锁 vs 表锁、共享锁 vs 排他锁）有了实操经验。"));

children.push(p("3. 存储过程 vs 应用层 SQL 的取舍", { bold: true }));
children.push(p("首先设计了完整的存储过程方案，但在 PyMySQL 驱动层遇到了 OUT 参数兼容性问题，最终改为应用层直接 SQL + 手动事务。这个过程让我理解了"技术选型需要结合驱动/框架的实际行为，而非盲目依赖数据库特性"。两种方案各有优劣：存储过程适合做数据密集型运算，应用层 SQL 更适合与 Web 框架的请求生命周期配合。"));

children.push(p("4. 信用机制的闭环设计", { bold: true }));
children.push(p("信用分不是孤立字段，而是一个闭环：预约 → 签到 → 缺席扣分 → 低分禁止预约。这种"行为 → 后果 → 约束"的设计模式在实际业务中非常常见，体现在数据库层面就是触发器/事件的联动。"));

children.push(subHeading("项目亮点"));
children.push(bullet("并发控制：SELECT ... FOR UPDATE 行级锁确保同一座位同一时段仅一人预约成功"));
children.push(bullet("自动化处理：MySQL 事件调度器每 5 分钟扫描超时预约，自动标记缺席、记录违约、扣除信用分"));
children.push(bullet("信用体系：闭环的信用打分机制，违规成本与行为约束联动"));
children.push(bullet("数据统计：4 个数据视图从不同维度（时段、座位、用户）提供分析数据"));
children.push(bullet("完整性保证：7 个外键、2 个 UNIQUE 约束、3 个 ENUM 约束、3 个复合索引"));

children.push(subHeading("不足与改进方向"));
const impChildren = [
  tableRow(["不足", "改进方向"], true, [3800, 5560]),
  tableRow(["页面刷新交互", "引入 AJAX/Fetch 实现无刷新预约和实时更新"], false, [3800, 5560]),
  tableRow(["预约通知", "引入邮件/短信提醒签到"], false, [3800, 5560]),
  tableRow(["权限粒度", "细化为超级管理员、馆长、值班员等多角色"], false, [3800, 5560]),
  tableRow(["移动端适配", "座位地图在手机上排列过密，需专门适配"], false, [3800, 5560]),
  tableRow(["未来日期预约", "当前可预约未来任意日期，可限制为近 7 天"], false, [3800, 5560]),
  tableRow(["单元测试", "使用 pytest 为控制器和数据库操作编写自动化测试"], false, [3800, 5560]),
];
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3800, 5560], rows: impChildren }));

children.push(subHeading("总结"));
children.push(p("本项目以自习室座位预约这一真实校园需求为背景，从数据库设计出发，完整实现了包含用户管理、座位地图、预约签到、信用管理、后台管理和数据统计的 Web 系统。在技术实现上，重点展现了关系型数据库的高级特性——行级锁的并发控制、存储过程的业务封装、事件调度器的自动化处理和视图的多维统计。通过本次课程设计，对数据库系统概论的核心内容——关系模型、范式理论、索引优化、事务与并发、存储过程与触发器——有了从理论到实践的完整认知。"));

// ============================================================
// Build Document
// ============================================================

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Microsoft YaHei", size: 22 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Microsoft YaHei", color: "1A3C34" },
        paragraph: { spacing: { before: 400, after: 240 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Microsoft YaHei", color: "1A3C34" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1200, bottom: 1440, left: 1200 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 0 },
          children: [new TextRun({ text: "数据库系统概论 — 课程设计报告", size: 16, color: "999999", font: "Microsoft YaHei", italics: true })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 0 },
          children: [
            new TextRun({ text: "第 ", size: 16, color: "999999" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" }),
            new TextRun({ text: " 页", size: 16, color: "999999" }),
          ],
        })],
      }),
    },
    children,
  }],
});

// Write file
Packer.toBuffer(doc).then(buffer => {
  const outPath = process.argv[2] || "C:/Users/18773/Desktop/seat-reservation/report/课程设计报告.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("DOCX created: " + outPath);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
