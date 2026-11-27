# سایت مشاوره آقای عضله

سایت فارسی و راست‌چین فرم مشاوره با ۷ سؤال و پنل خصوصی مربی.

## اجزای پروژه
- public/index.html: فرم عمومی متقاضیان
- public/admin.html: پنل خصوصی مشاهده و مدیریت درخواست‌ها
- src/index.js: API ثبت درخواست‌ها، احراز هویت پنل و اتصال به KV
- wrangler.jsonc: تنظیمات انتشار Cloudflare Worker و منابع پروژه

## رفتار فرم
- دکمه ثبت پس از تکمیل هر ۷ پاسخ نمایش داده می‌شود.
- پیش از ثبت، متقاضی رضایت خود را برای ذخیره و پیگیری اطلاعات اعلام می‌کند.
- پس از ثبت موفق، پاسخ‌ها در KV ذخیره می‌شوند؛ پیام روبیکا فقط یک راه ارتباط تکمیلی است.
- هیچ اطلاعات مشتری در کد مرورگر یا مخزن GitHub ذخیره نمی‌شود.
- اطلاعات درخواست حداکثر ۱۸۰ روز نگهداری می‌شود و از پنل قابل حذف است.

## انتشار
Workers Builds پس از هر commit روی شاخه main دستور npx wrangler deploy را اجرا می‌کند.
نام Worker در wrangler.jsonc باید با نام Worker در Cloudflare یکسان باشد: mr-muscle-consultation.

## فضای ذخیره‌سازی
یک KV binding با نام LEADS در wrangler.jsonc تعریف شده است. در صورت پشتیبانی حساب/توکن Build، Wrangler هنگام استقرار namespace را به‌صورت خودکار ایجاد می‌کند. شناسه منبع در مخزن قرار داده نمی‌شود و در حساب Cloudflare نگهداری می‌شود.

## رمز پنل
برای فعال‌سازی پنل، در Cloudflare وارد Worker با نام mr-muscle-consultation شو:
Settings → Variables and Secrets → Add → Type: Secret
نام متغیر: ADMIN_TOKEN
مقدار: یک توکن تصادفی محرمانه با حداقل ۳۲ نویسه.
سپس Save and Deploy را اجرا کن.

نشانی پنل:
https://mr-muscle-consultation.majnoonierfan.workers.dev/admin.html

توکن را هرگز در GitHub، فایل‌های عمومی یا پیام‌های قابل مشاهده برای مشتریان قرار نده. پنل توکن را فقط در sessionStorage نشست مرورگر نگه می‌دارد.
