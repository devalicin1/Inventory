# QuickBooks Entegrasyonu - Adım Adım Kurulum Rehberi (TEST MODU)

> 🧪 **TEST MODU**: Bu rehber, **Sandbox (Test) ortamında** entegrasyonu kurmak için hazırlanmıştır.
> Gerçek şirket verilerinizi etkilemez. Test tamamlandıktan sonra Production'a geçebilirsiniz.

Bu rehber, QuickBooks entegrasyonunu **test ortamında** sıfırdan kurmak için adım adım talimatlar içerir.

## 📋 Ön Hazırlık

> ⚠️ **ÖNEMLİ AYRIM**: 
> - **Intuit Developer Hesabı**: App oluşturmak için (tek seferlik, ücretsiz)
> - **QuickBooks Şirket Hesabı**: Gerçek verilerin olduğu hesap (zaten kullanıyorsunuz)
> 
> Bu iki hesap **farklı**! Developer hesabında app oluşturup, sonra bunu mevcut şirket hesabınıza bağlayacaksınız.

### Adım 1: Intuit Developer Hesabı Oluşturma (Tek Seferlik)

> 💡 **Not**: Eğer zaten bir Intuit Developer hesabınız varsa, bu adımı atlayabilirsiniz.

1. **Intuit Developer'a Git**
   - Tarayıcıda şu adrese git: https://developer.intuit.com/
   - Sağ üst köşeden **"Sign In"** veya **"Create Account"** butonuna tıkla
   - ⚠️ **DİKKAT**: Bu, QuickBooks şirket hesabınızdan **FARKLI** bir hesap!
   - Yeni bir hesap oluştur (ücretsiz, sadece app oluşturmak için)

2. **Giriş Yap**
   - Oluşturduğun hesap bilgileriyle giriş yap
   - Veya eğer zaten varsa, mevcut Developer hesabınla giriş yap

### Adım 2: Yeni Uygulama (App) Oluşturma

1. **Dashboard'a Git**
   - Giriş yaptıktan sonra **"My Apps"** veya **"Dashboard"** sayfasına git
   - **"Create an app"** veya **"New App"** butonuna tıkla

2. **Uygulama Bilgilerini Doldur**
   - **App Name**: Örn: "Inventory Management Integration - Test"
   - **App Type**: **"QuickBooks Online"** seç
   - **Environment**: **"Sandbox"** seç (TEST için)
     - ✅ Sandbox = Test ortamı, gerçek verilerinizi etkilemez
     - ✅ Ücretsiz ve sınırsız test yapabilirsiniz
   - **OAuth 2.0**: Otomatik olarak seçili olacak

3. **Redirect URI Ekle**
   - **Redirect URIs** bölümüne şunu ekle:
     - **Development için**: `http://localhost:5173/quickbooks/callback`
     - **Production için**: `https://yourdomain.com/quickbooks/callback`
     - Her ikisini de ekleyebilirsiniz
   - **"Add"** veya **"Save"** butonuna tıkla

4. **Sandbox Keys'i Kaydet**
   - App oluşturulduktan sonra, **"Keys"** veya **"Credentials"** sekmesine git
   - **"Sandbox Keys"** veya **"Development Keys"** bölümünü bul
   - Keys otomatik olarak oluşturulmuş olacak
   - ⚠️ **ÖNEMLİ**: Bu bilgileri bir yere not et:
     - ✅ **Client ID (OAuth 2.0 Client ID)** - Sandbox için
     - ✅ **Client Secret (OAuth 2.0 Client Secret)** - Sandbox için
   - ⚠️ **ÇOK ÖNEMLİ**: Client Secret'ı bir daha göremeyebilirsin, mutlaka kaydet!
   - 💡 **Not**: Sandbox keys test için, Production keys gerçek veriler için

### Adım 3: Sandbox Test QuickBooks Hesabı Oluşturma

> 🧪 **TEST İÇİN**: Gerçek şirket hesabınızı kullanmayacağız, test için özel bir Sandbox hesabı oluşturacağız.

1. **Sandbox Company Oluştur**
   - Intuit Developer Dashboard'da uygulamanızın yanında **"Sandbox"** linkine tıkla
   - Veya direkt: https://appcenter.intuit.com/connect/oauth2
   - **"Create a sandbox company"** veya **"Get sandbox company"** butonuna tıkla

2. **Test Hesabı Oluştur**
   - Yeni bir QuickBooks test hesabı oluştur
   - Bu hesap **tamamen test için**, gerçek verilerinizi etkilemez
   - Email ve şifre belirle (gerçek hesabınızdan farklı olabilir)

3. **Test Hesabına Giriş Yap**
   - Oluşturduğun test hesabıyla giriş yap
   - Bu hesapta test verileri oluşturabilirsin
   - ⚠️ **ÖNEMLİ**: Bu gerçek şirket hesabınız DEĞİL, sadece test için!

4. **Hazır!**
   - Test hesabınız hazır, şimdi Developer app'ini bu test hesabına bağlayacağız

---

## 🚀 Uygulamada Kurulum

### Adım 4: Settings Sayfasına Git

1. **Uygulamayı Aç**
   - Inventory uygulamanı çalıştır
   - Tarayıcıda: `http://localhost:5173` (veya deploy ettiğin URL)

2. **Settings'e Git**
   - Sol menüden **"Settings"** (⚙️) seçeneğine tıkla
   - Veya direkt URL: `http://localhost:5173/settings`

3. **QuickBooks Tab'ını Bul**
   - Settings sayfasında en sağdaki **"QuickBooks"** 💼 tab'ına tıkla

### Adım 5: Konfigürasyonu Doldur

1. **"Configure" Butonuna Tıkla**
   - Eğer bağlı değilse, **"Configure"** butonuna tıkla
   - Form açılacak

2. **Bilgileri Gir**
   - **Client ID**: Intuit Developer'dan kopyaladığın **Sandbox Client ID**'yi yapıştır
   - **Client Secret**: Intuit Developer'dan kopyaladığın **Sandbox Client Secret**'ı yapıştır
   - **Redirect URI**: 
     - Test için: `http://localhost:5173/quickbooks/callback`
     - (Production için daha sonra domain ekleyebilirsin)
   - **Environment**: **"Sandbox (Testing)"** seç
     - ✅ **TEST MODU**: Sandbox seçerseniz, sadece test verileriyle çalışacaksınız!
     - ✅ Gerçek şirket verileriniz etkilenmez

3. **"Save Configuration" Butonuna Tıkla**
   - Formu kaydet
   - Başarı mesajı göreceksin

### Adım 6: Sandbox Test QuickBooks Hesabına Bağlan

> 🧪 **TEST MODU**: Bu adımda, Developer app'ini **Sandbox test QuickBooks hesabınıza** bağlayacaksınız.

1. **"Connect to QuickBooks" Butonuna Tıkla**
   - Konfigürasyon kaydedildikten sonra **"Connect to QuickBooks"** butonu görünecek
   - Butona tıkla

2. **QuickBooks Authorization Sayfası**
   - Yeni bir pencere açılacak (veya yeni tab)
   - QuickBooks giriş sayfası görünecek

3. **Sandbox Test Hesabınızla Giriş Yap**
   - ✅ **TEST İÇİN**: Adım 3'te oluşturduğun **Sandbox test hesabıyla** giriş yap!
   - ⚠️ **DİKKAT**: Gerçek şirket hesabınızla DEĞİL, test hesabıyla giriş yapmalısınız!
   - Test hesabının email ve şifresiyle giriş yapın

4. **Test Şirketini Seç**
   - Eğer birden fazla test şirketi varsa, bağlamak istediğinizi seçin
   - Sandbox'ta genelde tek bir test şirketi olur

5. **Yetkilendir**
   - QuickBooks, uygulamanın erişim izni isteyecek
   - Hangi verilere erişim istediğini göreceksin:
     - ✅ Accounting (muhasebe verileri)
     - ✅ Inventory (stok verileri)
     - ✅ vb.
   - **"Authorize"** veya **"Connect"** butonuna tıkla
   - ✅ **TEST MODU**: Bu işlem sadece test verilerinize erişim verecek, gerçek verileriniz etkilenmez!

6. **Callback Sayfası**
   - Otomatik olarak callback sayfasına yönlendirileceksin
   - "Connected!" mesajı göreceksin
   - 2 saniye sonra otomatik olarak Settings sayfasına dönecek

7. **Bağlantı Durumunu Kontrol Et**
   - Settings → QuickBooks tab'ında
   - ✅ **"Connected to QuickBooks"** mesajını görmelisin
   - Environment: **Sandbox** görünecek (TEST modu)
   - Company ID (Realm ID) görünecek - bu test hesabınızın ID'si

---

## 🔄 Senkronizasyon İşlemleri

### Adım 7: Ürünleri QuickBooks'a Senkronize Et

1. **Ürünlerin Hazır Olduğundan Emin Ol**
   - Inventory sayfasına git
   - Senkronize etmek istediğin ürünlerin olduğundan emin ol
   - ⚠️ **ÖNEMLİ**: Her ürünün **SKU** değeri olmalı!

2. **Sync Products Butonuna Tıkla**
   - Settings → QuickBooks tab'ına dön
   - **"Sync Products to QuickBooks"** butonuna tıkla
   - Buton **"Syncing..."** olarak değişecek

3. **Sonucu Bekle**
   - Tüm ürünler tek tek QuickBooks'a gönderilecek
   - İşlem bitince toast mesajı göreceksin:
     - ✅ "Synced X products. Y errors." (başarılı)
     - ❌ Hata varsa detayları göreceksin

4. **Sandbox QuickBooks'ta Kontrol Et**
   - Sandbox test QuickBooks hesabınıza giriş yapın
   - **Products and Services** → **Products** sayfasına git
   - Senkronize ettiğin ürünleri görmelisin
   - ✅ **TEST MODU**: Bu test verileri, gerçek şirket verileriniz etkilenmez!

### Adım 8: Stok Seviyelerini Senkronize Et

1. **Sandbox QuickBooks'ta Stok Güncelle**
   - Sandbox test QuickBooks hesabınızda bir ürünün stok seviyesini değiştir
   - Örn: Bir ürünün miktarını 100'den 150'ye çıkar
   - ✅ **TEST MODU**: Bu test verileri, gerçek şirket verileriniz etkilenmez!

2. **Sync Inventory Butonuna Tıkla**
   - Settings → QuickBooks tab'ına dön
   - **"Sync Inventory from QuickBooks"** butonuna tıkla
   - Buton **"Syncing..."** olarak değişecek

3. **Sonucu Kontrol Et**
   - İşlem bitince toast mesajı: ✅ "Inventory synced successfully!"
   - Inventory sayfasına git
   - Ürünün stok seviyesinin güncellendiğini kontrol et

---

## ✅ Test Senaryoları

### Test 1: Yeni Ürün Ekleme ve Sync

1. Inventory'de yeni bir ürün oluştur
   - SKU: `TEST-001`
   - Name: `Test Product`
   - Quantity: `50`
   - Price: `29.99`

2. Settings → QuickBooks → "Sync Products to QuickBooks"
3. QuickBooks'ta kontrol et: Products listesinde `TEST-001` görünmeli

### Test 2: Stok Güncelleme

1. Sandbox test QuickBooks hesabınızda bir ürünün stok seviyesini değiştir
2. Settings → QuickBooks → "Sync Inventory from QuickBooks"
3. Inventory'de kontrol et: Stok seviyesi güncellenmiş olmalı
4. ✅ **TEST MODU**: Bu test verileri, gerçek şirket verileriniz etkilenmez!

### Test 3: Çoklu Ürün Sync

1. Inventory'de 10 ürün oluştur (hepsinin SKU'su olsun)
2. Settings → QuickBooks → "Sync Products to QuickBooks"
3. Tüm ürünlerin QuickBooks'a gittiğini kontrol et

---

## 🐛 Sorun Giderme

### Sorun: "QuickBooks not configured"

**Çözüm:**
- Settings → QuickBooks tab'ında "Configure" butonuna tıkla
- Client ID ve Client Secret'ı doğru girdiğinden emin ol
- "Save Configuration" butonuna tıkladığından emin ol

### Sorun: "Connect to QuickBooks" butonu görünmüyor

**Çözüm:**
- Önce konfigürasyonu kaydetmen gerekiyor
- Client ID ve Client Secret dolu olmalı
- Sayfayı yenile (F5)

### Sorun: OAuth callback hatası

**Çözüm:**
- Intuit Developer dashboard'da Redirect URI'nin doğru olduğundan emin ol
- Localhost için: `http://localhost:5173/quickbooks/callback`
- Production için: `https://yourdomain.com/quickbooks/callback`
- Redirect URI'ler **tam olarak eşleşmeli** (büyük/küçük harf, slash, vb.)

### Sorun: Ürünler sync olmuyor

**Çözüm:**
- Her ürünün **SKU** değeri olduğundan emin ol
- SKU'lar benzersiz olmalı
- Console'da hata var mı kontrol et (F12 → Console)
- QuickBooks'ta manuel olarak aynı SKU'ya sahip ürün var mı kontrol et

### Sorun: Stok sync olmuyor

**Çözüm:**
- Ürünlerin önce QuickBooks'a sync edilmiş olması gerekiyor
- SKU'ların eşleştiğinden emin ol
- QuickBooks'ta ürünün stok seviyesinin değiştiğinden emin ol

### Sorun: Token expired hatası

**Çözüm:**
- Sistem otomatik olarak token'ı yenilemeli
- Eğer hata devam ederse:
  1. Settings → QuickBooks tab'ına git
  2. Tekrar "Connect to QuickBooks" butonuna tıkla
  3. Yeniden yetkilendir

---

## 📝 Önemli Notlar

1. **SKU Zorunluluğu**
   - Ürünlerin mutlaka SKU değeri olmalı
   - SKU'lar benzersiz olmalı
   - SKU olmadan sync çalışmaz

2. **Sandbox vs Production**
   - ✅ **SİZ SANDBOX (TEST) KULLANIYORSUNUZ**: Test verileriyle çalışıyorsunuz!
   - Her değişiklik sadece test verilerini etkiler
   - Gerçek şirket verileriniz etkilenmez
   - İstediğiniz kadar test yapabilirsiniz
   - Test tamamlandıktan sonra Production'a geçebilirsiniz

3. **Rate Limits**
   - QuickBooks API'nin limitleri var:
     - 500 istek/dakika
     - 10,000 istek/gün
   - Çok fazla ürün varsa, sync işlemi zaman alabilir

4. **Güvenlik**
   - Client Secret'ı asla frontend kodunda kullanma
   - Tüm API çağrıları Firebase Functions üzerinden yapılıyor
   - OAuth token'lar workspace bazında saklanıyor

---

## 🎯 Sonraki Adımlar

Entegrasyon çalıştıktan sonra:

1. ✅ Production environment'a geç
2. ✅ Otomatik sync schedule ekle (gelecek özellik)
3. ✅ Invoice oluşturma özelliğini test et
4. ✅ Customer sync özelliğini ekle (gelecek özellik)

---

## 💡 İpuçları

- İlk test için 2-3 ürünle başla
- Her adımı tamamladıktan sonra kontrol et
- Console loglarını takip et (F12 → Console)
- QuickBooks'ta manuel kontrol yap
- Hata mesajlarını oku ve anlamaya çalış

---

## 📞 Yardım

Sorun yaşarsan:
1. Console loglarını kontrol et (F12)
2. Network tab'ında API çağrılarını kontrol et
3. QuickBooks API dokümantasyonuna bak: https://developer.intuit.com/app/developer/qbo/docs
4. QUICKBOOKS_INTEGRATION.md dosyasındaki troubleshooting bölümüne bak

