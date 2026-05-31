# Сайт брошюры «Мебельщикам в кризис»

Статический сайт из 13 страниц:
- главная (`index.html`) с обложкой, содержанием и блоком об авторе
- предисловие (`preface.html`)
- 9 статей (`articles/01.html` … `09.html`)
- заключение (`conclusion.html`)
- об авторе (`about.html`)

Плюс `Брошюра_Мебельщикам_в_кризис.docx` для скачивания одной кнопкой.

Размер сайта без .docx — ~2.5 МБ; с .docx — ~23 МБ. Без сборщиков, без зависимостей, без JavaScript-фреймворков.

---

## Локальная проверка

```powershell
cd "C:\Users\adubl\OneDrive\Рабочий стол\Проекты\Статьи и публикации\_сайт"
python -m http.server 8123
```

Открыть http://localhost:8123/ в браузере.

---

## Пересборка после правок

После любых изменений в источниках:
- `_брошюра/raw/*.md` — тексты статей
- `_брошюра/metadata.json` — части, автор, контакты
- `_брошюра/предисловие.md`
- `_брошюра/переходы.md`
- `_сайт/assets/styles.css` — оформление
- `_сайт/build-site.js` — структура страниц

запустите:

```powershell
cd "C:\Users\adubl\OneDrive\Рабочий стол\Проекты\Статьи и публикации\_сайт"
node build-site.js
```

Все HTML-страницы пересоберутся за 1–2 секунды.

---

## Публикация на GitHub Pages

### Вариант 1. Через GitHub Desktop (самый простой)

1. Зайдите на [github.com](https://github.com) → **New repository**.
   - Имя: например, `mebelshchikam-v-krizis` (только латиница, без пробелов)
   - Public
   - Без README, .gitignore и лицензии (всё уже есть в этой папке)
2. Скачайте [GitHub Desktop](https://desktop.github.com/).
3. В GitHub Desktop: **File → Add local repository** → выбрать папку `_сайт`.
4. **Publish repository** → подтвердить имя репозитория → готово.
5. Вернитесь на github.com → ваш репозиторий → **Settings → Pages**.
6. **Source: Deploy from a branch**, **Branch: main**, **Folder: / (root)**.
7. Через ~1 минуту по адресу `https://<ваш-логин>.github.io/<имя-репозитория>/` сайт открыт.

### Вариант 2. Через git CLI

```powershell
cd "C:\Users\adubl\OneDrive\Рабочий стол\Проекты\Статьи и публикации\_сайт"
git init
git add .
git commit -m "Сайт брошюры «Мебельщикам в кризис»"
git branch -M main
git remote add origin https://github.com/<ВАШ-ЛОГИН>/mebelshchikam-v-krizis.git
git push -u origin main
```

Дальше — те же шаги 5–7, что в варианте 1.

### Свой домен

Если хотите свой домен (например, `mebelnik.ru`):
1. В корне `_сайт/` создайте файл `CNAME` с одной строкой: `mebelnik.ru`.
2. В DNS вашего домена добавьте записи:
   - `A` запись на `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - или `CNAME` на `<ваш-логин>.github.io.`
3. В **Settings → Pages → Custom domain** введите домен и включите **Enforce HTTPS**.

---

## После публикации

После того как сайт будет доступен по реальному URL, обновите `sitemap.xml` — замените в нём `https://USERNAME.github.io/REPO/` на ваш реальный адрес. И пересоберите (`node build-site.js`) — генератор перепишет sitemap при следующей сборке, поэтому добавьте константу `SITE_URL` в `build-site.js`, если хотите автогенерацию.

---

## Что лежит в репозитории

```
_сайт/
├── index.html              ← главная
├── preface.html            ← предисловие
├── about.html              ← об авторе
├── conclusion.html         ← заключение
├── articles/               ← 9 страниц статей
│   ├── 01.html ... 09.html
├── assets/
│   └── styles.css          ← все стили
├── images/                 ← 18 картинок (статьи + фото автора)
├── Брошюра_Мебельщикам_в_кризис.docx  ← версия для скачивания
├── build-site.js           ← генератор (нужен только для пересборки)
├── sitemap.xml
├── robots.txt
├── .nojekyll               ← обязательно для GitHub Pages
└── README.md
```

`.nojekyll` обязателен — без него GitHub Pages игнорирует файлы и папки, начинающиеся с подчёркивания.
