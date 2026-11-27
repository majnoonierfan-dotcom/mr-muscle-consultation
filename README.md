# نسخه تازه سایت مشاوره آقای عضله (Cloudflare Worker)

این شاخه مستقل از نسخه قبلی است. سایت قبلی و شاخه main تغییر نمی‌کنند.

## امکانات
- فرم مشتری با دقیقاً ۷ سؤال
- نمایش دکمه ثبت فقط بعد از پاسخ به هر ۷ سؤال
- راهنمای مرحله‌به‌مرحله تکمیل و ثبت
- طراحی راست‌چین، سازگار با موبایل و بدون عرض ثابت یا اسکرول افقی
- ثبت درخواست‌ها در فضای KV مختص همین Worker
- صفحه خصوصی مربی در `/admin.html`؛ بدون رمز مدیر، پاسخ‌ها قابل مشاهده نیستند
- تغییر وضعیت درخواست به «پیگیری شد»، کپی آیدی و حذف درخواست
- ذخیره اطلاعات تا ۱۸۰ روز و محدودیت ضداسپم

## انتشار Worker جدید
1. در Cloudflare برو به **Workers & Pages** و گزینه **Create application** را بزن.
2. **Connect to Git** را انتخاب کن و مخزن `majnoonierfan-dotcom/mr-muscle-consultation` را وصل کن.
3. شاخه `fresh-mobile-v2` را به‌عنوان شاخهٔ اصلی انتشار (Production branch) انتخاب کن؛ نه `main`. مسیر ریشه پروژه همان ریشه مخزن است.
4. دستور انتشار را `npx wrangler deploy` قرار بده و Worker را بساز. تنظیمات Wrangler نام Worker را `mr-muscle-consultation-v2` می‌گذارد.
5. فایل Wrangler یک KV binding به نام `LEADS` دارد. هنگام اجرای `wrangler deploy` کلادفلر می‌تواند namespace را خودکار ایجاد کند؛ اگر در انتشار خطای KV دیدی، در **Settings → Bindings → Add → KV Namespace** یک فضای ذخیره‌سازی انتخاب و binding را دقیقاً `LEADS` نام‌گذاری کن.
6. بعد از اولین انتشار، در **Settings → Variables and Secrets → Add → Secret** یک Secret بساز:
   - نام: `ADMIN_TOKEN`
   - مقدار: یک رمز تصادفی محرمانه با حداقل ۳۲ نویسه
   سپس **Save and Deploy** را بزن.
7. آدرس عمومی فرم از این الگو خواهد بود: `https://mr-muscle-consultation-v2.majnoonierfan.workers.dev/`
   پنل خصوصی: `https://mr-muscle-consultation-v2.majnoonierfan.workers.dev/admin.html`

## ورود مربی
برای ورود به پنل، همان مقدار محرمانه `ADMIN_TOKEN` را وارد کن. این رمز در فایل‌های عمومی یا مخزن ذخیره نمی‌شود؛ فقط در Secretهای Cloudflare قرار می‌گیرد. آن را به مشتریان نده.

## نکته
ساخت فایل‌ها و شاخه Git به‌تنهایی Worker را در Cloudflare منتشر نمی‌کند. انتشار نهایی و ساخت Secret باید در حساب Cloudflare انجام شود. نسخه قبلی روی شاخه `main` و Worker قبلی دست‌نخورده باقی می‌ماند.


## تنظیمات ساخت Workers Builds
- ریشه پروژه: `/`
- Build command: خالی (نیازی به build جداگانه نیست)
- Deploy command: `npx wrangler deploy`
- نام Worker در داشبورد باید دقیقاً `mr-muscle-consultation-v2` باشد؛ Cloudflare برای اتصال Git، تطابق این نام با مقدار `name` در Wrangler را لازم می‌داند.
