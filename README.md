# booklibrary

Firebase tabanlı yazarlar için kitap yazma uygulaması. İlk hedef: Firebase Auth (email/şifre + Google) ile giriş/kayıt ve korumalı Dashboard.

## Hızlı Başlangıç

1) Web uygulaması bağımlılıklarını kurun:

```bash
cd web
npm install
```

2) Firebase projesi oluşturun ve `.env` dosyasını hazırlayın:

```bash
cp .env.example .env
# .env içine Firebase web app config değerlerini girin
```

Gerekli anahtarlar: `apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId`

3) Geliştirme sunucusunu çalıştırın:

```bash
npm run dev
```

4) Firebase Console > Authentication > Sign-in method:
- Email/Password etkinleştirin
- Google sağlayıcısını etkinleştirin

> İlk sürüm yalnızca giriş/kayıt ve boş bir Dashboard içerir. Profil (kullanıcı adı/telefon), PP yükleme, kitap kapak/görsel yükleme ve kütüphane/kitap yönetimi sonraki adımlarda eklenecek.

