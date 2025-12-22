# Admin Workspace Yönetimi - Test Rehberi

## Test Adımları

### 1. Super Admin Kullanıcısı Oluşturma

Super admin olarak giriş yapmak için `admin@inventory.com` email adresini kullanmanız gerekiyor.

**Adımlar:**
1. Uygulamayı çalıştırın: `npm run dev` (veya `yarn dev`)
2. Tarayıcıda `/login` sayfasına gidin
3. "Kayıt olun" butonuna tıklayın
4. Şu bilgileri girin:
   - **E-posta:** `admin@inventory.com`
   - **Şifre:** (en az 6 karakter)
   - **Ad Soyad:** (opsiyonel)
5. "Kayıt Ol" butonuna tıklayın

**Not:** Eğer farklı bir email ile super admin olmak istiyorsanız:
- `apps/web/src/utils/permissions.ts` dosyasındaki `SUPER_ADMIN_EMAILS` array'ine email'inizi ekleyin
- Veya Firebase Console'dan kullanıcı oluşturduktan sonra Firestore'da `users/{userId}` document'ine `isSuperAdmin: true` ekleyin

### 2. İlk Workspace Oluşturma

Super admin olarak giriş yaptıktan sonra:

1. Sidebar'da "Admin" menü öğesini göreceksiniz (ShieldCheck ikonu)
2. "Admin" sayfasına tıklayın
3. Sağ üstteki "Yeni Workspace" butonuna tıklayın
4. Workspace bilgilerini girin:
   - **Workspace Adı:** Örn: "Test Şirketi"
   - **Para Birimi:** USD, EUR veya TRY
   - **Zaman Dilimi:** America/New_York, Europe/Istanbul veya UTC
5. "Oluştur" butonuna tıklayın
6. Workspace oluşturulduktan sonra otomatik olarak owner rolü ile bu workspace'e eklenirsiniz

### 3. Workspace'e Kullanıcı Ekleme

1. Admin sayfasında oluşturduğunuz workspace'in yanındaki "Detaylar" butonuna tıklayın
2. Açılan modal'da "Kullanıcı Ekle" butonuna tıklayın
3. Yeni kullanıcı bilgilerini girin:
   - **E-posta:** Yeni kullanıcının email adresi
   - **Şifre:** (en az 6 karakter)
   - **Ad Soyad:** (opsiyonel)
   - **Rol:** Owner, Admin, Manager, Staff veya Operator
4. "Ekle" butonuna tıklayın
5. Kullanıcı oluşturulur ve workspace'e eklenir

### 4. Kullanıcı Rolünü Güncelleme

1. Workspace detay modal'ında kullanıcı listesini görüntüleyin
2. Kullanıcının rolünü değiştirmek için dropdown menüden yeni rolü seçin
3. Rol otomatik olarak güncellenir

### 5. Kullanıcıyı Workspace'den Çıkarma

1. Workspace detay modal'ında kullanıcı listesini görüntüleyin
2. Kaldırmak istediğiniz kullanıcının yanındaki çöp kutusu ikonuna tıklayın
3. Kullanıcı workspace'den çıkarılır

### 6. Normal Kullanıcı ile Test

1. Yeni bir kullanıcı oluşturun (super admin email'i dışında bir email)
2. Bu kullanıcı ile giriş yapın
3. Sidebar'da "Admin" menü öğesini görmeyeceksiniz (super admin değil)
4. Workspace'e atandıysanız normal kullanıcı olarak çalışabilirsiniz

## Test Senaryoları

### Senaryo 1: İlk Kurulum
1. ✅ Super admin kullanıcısı oluştur
2. ✅ İlk workspace oluştur
3. ✅ Workspace'e kullanıcı ekle
4. ✅ Kullanıcı rolünü değiştir

### Senaryo 2: Çoklu Workspace
1. ✅ Birden fazla workspace oluştur
2. ✅ Her workspace'e farklı kullanıcılar ekle
3. ✅ Workspace listesinde tüm workspace'leri görüntüle

### Senaryo 3: Rol Yönetimi
1. ✅ Farklı rollere sahip kullanıcılar oluştur
2. ✅ Rolleri güncelle
3. ✅ Kullanıcıları workspace'den çıkar

### Senaryo 4: Güvenlik
1. ✅ Normal kullanıcı admin sayfasına erişememeli
2. ✅ Workspace üyesi olmayan kullanıcı workspace verilerine erişememeli
3. ✅ Protected route'lar çalışmalı

## Sorun Giderme

### Super Admin Olarak Görünmüyorum
- `apps/web/src/utils/permissions.ts` dosyasında email'inizin `SUPER_ADMIN_EMAILS` listesinde olduğundan emin olun
- Veya Firestore'da `users/{userId}` document'inde `isSuperAdmin: true` olduğundan emin olun
- Sayfayı yenileyin (F5)

### Workspace Oluşturulamıyor
- Firebase Console'da Firestore'un aktif olduğundan emin olun
- Browser console'da hata mesajlarını kontrol edin
- Firestore security rules'un doğru deploy edildiğinden emin olun

### Kullanıcı Eklenemiyor
- Email adresinin geçerli olduğundan emin olun
- Şifrenin en az 6 karakter olduğundan emin olun
- Firebase Auth'un aktif olduğundan emin olun

### Protected Route Çalışmıyor
- Kullanıcının giriş yaptığından emin olun
- Session store'un doğru güncellendiğini kontrol edin
- Browser console'da hata mesajlarını kontrol edin

## Firebase Console Kontrolleri

Test sırasında Firebase Console'da kontrol edebileceğiniz yerler:

1. **Authentication > Users:** Tüm kullanıcıları görüntüleyin
2. **Firestore Database:**
   - `workspaces/{workspaceId}` - Workspace bilgileri
   - `workspaces/{workspaceId}/users/{userId}` - Workspace kullanıcı üyelikleri
   - `users/{userId}` - Kullanıcı profilleri

## Önemli Notlar

1. **Super Admin Email:** Şu anda `admin@inventory.com` super admin olarak tanımlı. Farklı bir email kullanmak isterseniz `permissions.ts` dosyasını güncelleyin.

2. **Firestore Rules:** Security rules production'da daha sıkı olmalı. Şu anda development için esnek kurallar var.

3. **İlk Workspace:** İlk workspace'i oluşturan kullanıcı otomatik olarak "owner" rolü alır.

4. **Kullanıcı Silme:** Kullanıcıyı workspace'den çıkarmak, Firebase Auth'dan silmez, sadece workspace üyeliğini kaldırır.
