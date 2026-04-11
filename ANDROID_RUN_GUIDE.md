# Coin Planet App - Android 模拟器运行指南

## 📱 当前状态

✅ **已完成**
- Android模拟器已启动：`emulator-5554`
- ADB连接验证：✓
- 依赖安装完成
- 环境配置文件已创建：`.env.local`
- 安装脚本已生成：`install_android.bat`

⏳ **需要解决**
- Gradle Java工具链配置

---

## 快速解决方案 - 三选一

### 方案 A：使用 Expo Go App（推荐，最快 ⚡）

**步骤1：下载Expo Go APK**
```
访问: https://expo.dev/go 
下载 Android 版本 (.apk)
或在Google Play中搜索 "Expo Go"
```

**步骤2：安装Expo Go到模拟器**
```bash
adb install -r path/to/ExpoGo.apk
```

**步骤3：启动Expo开发服务器**
```bash
cd app-client
npm install
npx expo start
# 或
npm run start
```

**步骤4：在Expo Go中打开项目**
- 扫描终端显示的QR码
- 或输入URL：`exp://localhost:8081`
- 或通过LAN连接

---

### 方案 B：修复Gradle并编译APK（完整，但需要时间）

**问题根源**
```
Java 17 工具链下载失败
原因：DNS 或网络配置问题
```

**解决步骤**

1. **安装Java 17（手动）**
   ```bash
   # 下载 Eclipse Temurin OpenJDK 17
   # 访问: https://adoptium.net/temurin/releases/
   # 安装到: C:\Program Files\Java\jdk-17
   ```

2. **配置Gradle使用本地Java**
   ```bash
   cd app-client/android
   echo org.gradle.java.home=C:\\\Program Files\\\Java\\\jdk-17.0.10 >> gradle.properties
   ```

3. **重新构建**
   ```bash
   gradlew.bat assembleDebug
   ```

4. **安装APK**
   ```bash
   adb install -r app\build\outputs\apk\debug\app-debug.apk
   ```

---

### 方案 C：使用开发库直接运行（仅Web预览）

```bash
cd app-client
npm start -- --web
```

这将在浏览器中打开Web版本（部分功能可能不可用）

---

## 完整开发工作流程

### 本地完整栈运行

**终端1：启动后台API**
```bash
cd backend
npm install
npm run dev
# 访问 http://127.0.0.1:8787
```

**终端2：启动Expo开发服务器**
```bash
cd app-client
npm install
npm start
# 选择 'a' 运行在Android
# 或扫描QR码用Expo Go打开
```

**终端3（可选）：监听Expo日志**
```bash
adb logcat | grep -E "Expo|ReactNative|coinplanet"
```

---

## 环境变量验证

APP已配置的环境变量（`app-client/.env.local`）：

```env
# API后台（模拟器访问主机用10.0.2.2）
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8788

# 区块链
EXPO_PUBLIC_CHAIN_ID=11155111
EXPO_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161

# 合约地址（部署后更新）
EXPO_PUBLIC_MINING_POOL_ADDRESS=0x...
EXPO_PUBLIC_SWAP_ROUTER_ADDRESS=0x...
```

**关键点：**
- Android模拟器访问主机：使用 `10.0.2.2` 而不是 `localhost`
- 后台API必须在端口 8788 运行
- 合约地址需从链上部署获取

---

## 常见问题

### Q1: "Cannot find module 'expo'"
**A:** 运行 `npm install` 重新安装依赖

### Q2: "emulator not found"  
**A:** 启动模拟器
```bash
emulator -avd Medium_Phone_API_36.1
```

### Q3: "Gradle build failed"
**A:** 下载Eclipse Temurin JDK 17 并配置 `gradle.properties`

### Q4: "后台API无法连接"
**A:** 
- 确保后端运行在8787或8788
- 模拟器中用 `10.0.2.2` 访问主机
- 检查防火墙设置

### Q5: "QR码扫描不了"
**A:** 在Expo Go中手动输入localhost地址

---

## 测试APP功能

APP启动后，可以测试以下流程：

1. **钱包连接**
   - 硬编码私钥自动加载
   - 显示钱包地址（短格式）

2. **矿工注册**
   - 输入算力值
   - 提交链上交易
   - 查看txHash

3. **收益领取**
   - 从MiningPool领取SUPER Token
   - 查看交易状态

4. **兑换功能**
   - 输入SUPER数量
   - 查看实时汇率
   - 执行SUPER→USDT兑换

5. **签名验证**
   - 所有API请求自动签名
   - 后台验证签名

---

## 日志查看

从模拟器查看APP日志：

```bash
# 查看所有日志
adb logcat

# 过滤miner和Expo相关日志
adb logcat | grep -i "miner\|expo\|Error"

# 清除日志
adb logcat -c

# 查看特定APP的日志
adb logcat --pid=$(adb shell pidof com.coinplanet.mobile)
```

---

## 下一步

一旦APP在模拟器上运行成功：

1. **部署合约到Sepolia**
   ```bash
   cd contracts
   npm run deploy:sepolia
   ```

2. **更新合约地址到`.env.local`**

3. **测试完整流程**
   - 钱包连接
   - 链上交易
   - 后台API同步
   - 数据持久化

4. **生产构建**
   ```bash
   eas build --platform android
   ```

---

## 技术栈验证

✅ React Native 0.76.6  
✅ Expo 52.0.25  
✅ Viem 2.37.2  
✅ AsyncStorage 3.0.2  
✅ Android SDK 36+  
✅ Gradle 8.10.2  

---

**生成时间**: 2026-04-11  
**Last Update**: 首次生成
