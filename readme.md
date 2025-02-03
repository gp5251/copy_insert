# CopyInsert

一个简单但功能强大的文件处理工具，可以快速复制文件到指定目录并进行处理。

## 功能特点

- 支持图片压缩功能
- 支持右键菜单快速处理文件
- 可配置目标目录和压缩质量
- 支持路径别名配置
- 窗口置顶功能

## 安装

```bash
# 安装依赖
pnpm install

# 启动应用
pnpm start
```

## 配置说明

- 目标目录：文件将被复制到的目录
- 图片压缩质量：1-100之间的数值，数值越大质量越好
- 路径别名：配置路径别名，如 {"@": "assets"} 将把完整路径中的目标目录替换为 "@:"

## 使用方法

1. 在文件管理器中选择一个或多个文件
2. 按下快捷键（默认 Alt+M）
3. 文件将被自动复制到配置的目标目录
4. 如果是图片文件，将根据设置进行压缩
5. 处理后的文件路径会自动复制到剪贴板

## 注意事项

- 首次运行时会在用户文档目录下创建 CopyInsert 文件夹
- 如果遇到文件名冲突，会自动添加数字后缀
- 多文件复制时，剪贴板中的路径将是目标目录而不是具体文件