# Android 模拟器窗口位置修复指南

## 问题描述
在多显示屏环境中，Android 模拟器窗口显示在错误的位置，无法在屏幕中央显示。

## 解决方案

### 方案 1: 使用启动脚本（推荐）

#### 方案 1a - 简单脚本
```powershell
# 在 PowerShell 中运行：
.\scripts\start-android-emulator.ps1
```
这将启动第一个可用的虚拟设备，窗口位置设置为 (420, 0)，适合大多数 1920x1080 屏幕。

#### 方案 1b - 高级脚本（更灵活）
```powershell
# 基础用法 - 选择默认设备
.\scripts\start-android-emulator-advanced.ps1

# 交互式选择设备和位置
.\scripts\start-android-emulator-advanced.ps1 -interactive

# 指定窗口位置
.\scripts\start-android-emulator-advanced.ps1 -windowX 400 -windowY 100

# 尝试自动计算屏幕中央位置
.\scripts\start-android-emulator-advanced.ps1 -center

# 指定特定的虚拟设备
.\scripts\start-android-emulator-advanced.ps1 -avdName "Pixel_6_API_33"
```

### 方案 2: 直接命令行启动

#### 获取可用设备
```powershell
$env:ANDROID_HOME\emulator\emulator.exe -list-avds
```

#### 启动模拟器并指定窗口位置
```powershell
# 基本命令
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd <设备名> -window-pos 420,0

# 完整命令（推荐）
& "$env:ANDROID_HOME\emulator\emulator.exe" `
  -avd <设备名> `
  -window-pos 420,0 `
  -no-snapshot-load `
  -netdelay none `
  -netspeed full
```

**参数说明：**
- `-avd <name>`: 虚拟设备名称
- `-window-pos X,Y`: 窗口左上角位置（像素）
- `-no-snapshot-load`: 不从快照加载
- `-netdelay none`: 无网络延迟
- `-netspeed full`: 最大网络速度

### 方案 3: 修改 AVD 配置文件

AVD 配置文件位置：`~/.android/avd/<设备名>/config.ini`

添加或修改以下参数：
```ini
window.x=420
window.y=0
```

### 方案 4: 计算你的屏幕中央位置

对于多显示屏设置，需要根据你的屏幕分辨率计算：

**计算公式：**
```
x坐标 = (屏幕宽度 - 模拟器窗口宽度) / 2
y坐标 = (屏幕高度 - 模拟器窗口高度) / 2
```

**常见配置示例：**
- 单个 1920x1080 屏幕 + 1080像素宽的模拟器 → x = (1920-1080)/2 = 420, y = 0
- 单个 3440x1440 超宽屏 + 1080像素宽的模拟器 → x = (3440-1080)/2 = 1180, y = 0
- 双屏的第二个屏幕中央：x = 1920 + (1920-1080)/2 = 2940, y = 0

### 方案 5: 使用 NPM 脚本（如果需要）

在 `app-client/package.json` 中添加：
```json
{
  "scripts": {
    "android:start": "powershell -NoProfile -ExecutionPolicy Bypass -File \"../scripts/start-android-emulator-advanced.ps1\" -interactive",
    "android:center": "powershell -NoProfile -ExecutionPolicy Bypass -File \"../scripts/start-android-emulator-advanced.ps1\" -center"
  }
}
```

然后运行：
```bash
npm run android:start
# 或
npm run android:center
```

## 故障排查

### 问题：命令未找到
**解决：** 确保已设置 `ANDROID_HOME` 环境变量
```powershell
# 查看当前值
$env:ANDROID_HOME

# 如果为空，设置它（示例）
$env:ANDROID_HOME = "C:\Android\sdk"
```

### 问题：模拟器仍在错误的屏幕上
**解决：** 
1. 检查你的屏幕分辨率和排列
2. 调整 `-window-pos` 参数值
3. 尝试方案 5 中的配置文件修改

### 问题：模拟器窗口太小或太大
**解决：** 在启动参数中添加 `-scale` 参数
```powershell
& "$env:ANDROID_HOME\emulator\emulator.exe" `
  -avd <设备名> `
  -window-pos 420,0 `
  -scale 0.8
```

## 调试技巧

### 查看模拟器支持的所有参数
```powershell
& "$env:ANDROID_HOME\emulator\emulator.exe" -help
```

### 查看窗口位置信息
启动模拟器后，在 Android 开发者菜单中可以查看窗口信息。

## 推荐使用

对于日常开发，推荐使用：
```powershell
.\scripts\start-android-emulator-advanced.ps1 -interactive
```

这样每次都可以选择设备和位置方案，最灵活方便。
