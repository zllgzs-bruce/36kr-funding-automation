# 话单数据库 - TODO

## 核心功能

- [x] 统一账号密码登录验证（团队共享凭证，不依赖 Manus OAuth）
- [x] 按公司名模糊搜索
- [x] 按联系人姓名模糊搜索
- [x] 搜索结果分页展示（每页20条）
- [x] 全字段展示：公司名、联系人、职位、电话、邮箱、来源文件、来源标签
- [x] 联系人信息编辑（所有登录用户可编辑）
- [x] 193,410条话单数据迁移到MySQL

## 数据库

- [x] contacts表Schema设计（修复phone/contact_name字段长度，修复priority_time类型）
- [x] 数据库迁移推送
- [x] 从SQLite批量导入数据到MySQL

## 前端

- [x] 登录页面（账号密码表单，纯密码登录）
- [x] 搜索主页（双维度搜索框 + 结果列表）
- [x] 编辑弹窗（行内编辑联系人信息）
- [x] 响应式布局（桌面表格 + 移动端卡片）

## 后端接口

- [x] teamLogin（统一账号密码验证，生成兼容JWT）
- [x] contacts.search（模糊搜索+分页）
- [x] contacts.update（编辑联系人）
- [x] contacts.count（总数统计）

## 待优化（未来可做）

- [ ] 搜索支持更多字段（电话、邮箱、来源标签）
- [ ] 数据导出功能（Excel/CSV）
- [ ] 编辑历史记录（谁在什么时间改了什么）
- [ ] 批量导入新联系人

## 编辑历史功能（新增）

- [x] contact_edit_logs 表 schema 设计（contact_id, field, old_value, new_value, edited_by, created_at）
- [x] 数据库迁移推送
- [x] 修改 contacts.update 接口，写入历史记录
- [x] 新增 contacts.getHistory 接口（按 contact_id 查询）
- [x] 新增 editLogs.list 接口（全局历史，支持分页）
- [x] 编辑历史前端页面（全局历史列表）
- [x] 导航栏增加“编辑历史”入口（顶部 Tab 切换）
- [x] Vitest 测试覆盖历史记录写入逻辑（13 项测试全部通过）

## 操作人显示优化（新增）

- [x] 登录页面添加“你的姓名”输入框（必填）
- [x] 后端 teamLogin 接口接收 userName 参数，写入 JWT 的 name 字段
- [x] 顶部导航栏显示当前登录人姓名
- [x] 编辑历史中操作人显示真实姓名
- [x] Vitest 测试覆盖姓名写入逻辑（16 项测试全部通过）
