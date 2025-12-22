# Firebase Authentication Kurulum Rehberi

## 400 Bad Request Hatası Çözümü

Eğer kayıt olurken veya giriş yaparken `400 Bad Request` hatası alıyorsanız, aşağıdaki adımları takip edin:

## 1. Firebase Console'da Email/Password Authentication'ı Etkinleştirme

1. [Firebase Console](https://console.firebase.google.com/)'a gidin
2. Projenizi seçin
3. Sol menüden **Authentication** > **Sign-in method**'a gidin
4. **Email/Password** provider'ını bulun
5. **Enable** butonuna tıklayın
6. **Email link (passwordless sign-in)** opsiyonunu isterseniz etkinleştirebilirsiniz (opsiyonel)
7. **Save** butonuna tıklayın

## 2. Authorized Domains Kontrolü

1. Firebase Console > **Authentication** > **Settings** > **Authorized domains**
2. Kullandığınız domain'in listede olduğundan emin olun
3. Development için `localhost` otomatik olarak eklenir
4. Production domain'inizi eklemeyi unutmayın

## 3. API Key Kontrolü

1. Firebase Console > **Project Settings** > **General**
2. **Your apps** bölümünden web uygulamanızı seçin
3. **API Key**'in doğru olduğundan emin olun
4. `apps/web/src/lib/firebase.ts` dosyasındaki API key ile eşleştiğinden emin olun

## 4. Firebase Config Kontrolü

`apps/web/src/lib/firebase.ts` dosyasındaki Firebase config'in doğru olduğundan emin olun:

```typescript
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  // ...
}
```

## 5. Browser Console'da Hata Kontrolü

Browser console'da (F12) daha detaylı hata mesajlarını görebilirsiniz:

1. Browser'ı açın (F12 veya Ctrl+Shift+I)
2. **Console** sekmesine gidin
3. Kayıt ol veya giriş yap butonuna tıklayın
4. Hata mesajını kontrol edin

## Yaygın Hatalar ve Çözümleri

### "auth/operation-not-allowed"
**Çözüm:** Firebase Console > Authentication > Sign-in method > Email/Password'u etkinleştirin

### "auth/invalid-api-key"
**Çözüm:** Firebase Console'dan doğru API key'i kopyalayın ve `firebase.ts` dosyasına yapıştırın

### "auth/unauthorized-domain"
**Çözüm:** Firebase Console > Authentication > Settings > Authorized domains'e domain'inizi ekleyin

### "auth/weak-password"
**Çözüm:** Şifre en az 6 karakter olmalı

### "auth/invalid-email"
**Çözüm:** Geçerli bir email adresi girin (örn: test@example.com)

## Test Adımları

1. ✅ Firebase Console'da Email/Password authentication etkin mi?
2. ✅ API key doğru mu?
3. ✅ Domain authorized mı?
4. ✅ Email formatı geçerli mi? (test@example.com)
5. ✅ Şifre en az 6 karakter mi?

## Hala Çalışmıyorsa

1. Browser cache'ini temizleyin (Ctrl+Shift+Delete)
2. Hard refresh yapın (Ctrl+Shift+R veya Cmd+Shift+R)
3. Uygulamayı yeniden başlatın
4. Firebase Console'da Authentication > Users bölümünde kullanıcı oluşup oluşmadığını kontrol edin
5. Browser console'da tam hata mesajını kontrol edin
