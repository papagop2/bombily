# 📱 Подробная инструкция по сборке APK для Android

## Предварительные требования

1. **Node.js** (уже установлен ✅)
2. **Java JDK 17 или выше** - [Скачать](https://adoptium.net/)
3. **Android Studio** - [Скачать](https://developer.android.com/studio)
4. **Android SDK** (устанавливается вместе с Android Studio)

## Шаг 1: Установка зависимостей проекта

```powershell
npm install
```

## Шаг 2: Настройка переменных окружения

Убедитесь, что файл `.env.local` создан и содержит:

```env
NEXT_PUBLIC_SUPABASE_URL=https://zlgayvflgfczmfvlycxo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZ2F5dmZsZ2Zjem1mdmx5Y3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MDcyNTYsImV4cCI6MjA3OTQ4MzI1Nn0.eP9hyP5-pHiKtp3qXGIurRX14xBiQAI2fNiC6A2e3Pw
NEXT_PUBLIC_APP_URL=https://your-production-domain.example.com
```

## Шаг 3: Добавление иконок приложения

Поместите файлы иконок в папку `public/`:
- `icon-192.png` (192x192 пикселей)
- `icon-512.png` (512x512 пикселей)

## Шаг 4: Сборка Next.js приложения

```powershell
npm run build
```

Деплойте `.next` на сервер (например, Vercel). Мобильное приложение Capacitor будет открывать этот URL, указанный в `NEXT_PUBLIC_APP_URL`. Локальная папка `out/` используется только как заглушка — все реальные данные берутся с сервера.

## Шаг 5: Установка Capacitor CLI (если еще не установлен)

```powershell
npm install -g @capacitor/cli
```

## Шаг 6: Инициализация Capacitor

```powershell
npx cap init
```

При запросе введите:
- **App name:** Бомбилы
- **App ID:** com.slyudtax.app
- **Web dir:** out

## Шаг 7: Добавление Android платформы

```powershell
npx cap add android
```

## Шаг 8: Синхронизация файлов

```powershell
npx cap sync android
```

Это скопирует файлы из `out/` в Android проект.

## Шаг 9: Настройка Android проекта

1. Откройте Android Studio
2. Выберите **File → Open**
3. Перейдите в папку `android/` вашего проекта
4. Дождитесь синхронизации Gradle (может занять несколько минут при первом запуске)

## Шаг 10: Настройка приложения в Android Studio

### 10.1. Настройка package name

1. Откройте `android/app/build.gradle`
2. Найдите `applicationId` и убедитесь, что это `com.slyudtax.app`

### 10.2. Настройка версии

В том же файле найдите:
```gradle
versionCode 1
versionName "1.0"
```

### 10.3. Настройка иконки приложения

1. В Android Studio откройте **File → New → Image Asset**
2. Выберите **Launcher Icons (Adaptive and Legacy)**
3. Загрузите вашу иконку `icon-512.png`
4. Нажмите **Next** и **Finish**

## Шаг 11: Сборка APK

### Вариант A: Debug APK (для тестирования)

1. В Android Studio выберите **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Дождитесь завершения сборки
3. APK будет в папке: `android/app/build/outputs/apk/debug/app-debug.apk`

### Вариант B: Release APK (для публикации)

1. **Создайте keystore** (только один раз):
   ```powershell
   cd android/app
   keytool -genkey -v -keystore slyudtax-release.keystore -alias slyudtax -keyalg RSA -keysize 2048 -validity 10000
   ```
   Введите пароль и данные (можно любые, кроме пароля - запомните его!)

2. **Создайте файл** `android/key.properties`:
   ```properties
   storePassword=ваш_пароль
   keyPassword=ваш_пароль
   keyAlias=slyudtax
   storeFile=slyudtax-release.keystore
   ```

3. **Обновите** `android/app/build.gradle`:
   ```gradle
   def keystoreProperties = new Properties()
   def keystorePropertiesFile = rootProject.file('key.properties')
   if (keystorePropertiesFile.exists()) {
       keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
   }
   
   android {
       ...
       signingConfigs {
           release {
               keyAlias keystoreProperties['keyAlias']
               keyPassword keystoreProperties['keyPassword']
               storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
               storePassword keystoreProperties['storePassword']
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
           }
       }
   }
   ```

4. **Соберите Release APK:**
   - В Android Studio: **Build → Generate Signed Bundle / APK**
   - Выберите **APK**
   - Выберите ваш keystore
   - Введите пароли
   - Выберите **release** build variant
   - Нажмите **Finish**

5. APK будет в: `android/app/build/outputs/apk/release/app-release.apk`

## Шаг 12: Установка APK на устройство

### Способ 1: Через USB

1. Включите **Отладка по USB** на Android устройстве:
   - Настройки → О телефоне → Нажмите 7 раз на "Номер сборки"
   - Настройки → Для разработчиков → Включите "Отладка по USB"

2. Подключите устройство к компьютеру

3. В Android Studio нажмите кнопку **Run** (зеленая стрелка) или выполните:
   ```powershell
   npx cap run android
   ```

### Способ 2: Прямая установка

1. Скопируйте APK файл на Android устройство
2. Откройте файл на устройстве
3. Разрешите установку из неизвестных источников (если требуется)
4. Установите приложение

## Быстрая команда для сборки (после настройки)

После первоначальной настройки, для пересборки:

```powershell
# 1. Соберите Next.js
npm run build

# 2. Синхронизируйте с Android
npx cap sync android

# 3. Откройте в Android Studio и соберите APK
# Или используйте командную строку:
cd android
./gradlew assembleDebug
```

## Решение проблем

### Ошибка: "SDK location not found"
Создайте файл `android/local.properties`:
```properties
sdk.dir=C:\\Users\\ВашеИмя\\AppData\\Local\\Android\\Sdk
```

### Ошибка: "Gradle sync failed"
1. В Android Studio: **File → Invalidate Caches / Restart**
2. Или обновите Gradle в `android/gradle/wrapper/gradle-wrapper.properties`

### Ошибка при сборке Next.js
Убедитесь, что переменные окружения настроены в `.env.local`

### APK слишком большой
Используйте ProGuard для минификации:
1. В `android/app/build.gradle` добавьте:
   ```gradle
   buildTypes {
       release {
           minifyEnabled true
           shrinkResources true
           proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
       }
   }
   ```

## Публикация в Google Play

1. Создайте аккаунт разработчика ($25 единоразово)
2. Создайте Release APK (см. Шаг 11, Вариант B)
3. Загрузите APK в Google Play Console
4. Заполните информацию о приложении
5. Отправьте на проверку

---

**Готово!** Теперь у вас есть работающее Android приложение! 🎉
