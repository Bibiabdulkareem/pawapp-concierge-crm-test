(() => {
  'use strict';

  const platforms = [
    ['instagram', 'إنستغرام', 'Instagram', '#b24d89'],
    ['facebook', 'فيسبوك', 'Facebook', '#3478d4'],
    ['metaAds', 'إعلانات Meta', 'Meta Ads', '#2465ae', 'الحساب محدد', 'Account identified', 'باقي اختبار قراءة نتائج Paw Ads.', 'Read access to Paw Ads campaign results still needs testing.'],
    ['whatsapp', 'واتساب', 'WhatsApp', '#249366', 'نجح اختبار عينة', 'Sample received', 'باقي تجربة رسالة فعلية على رقم الاختبار.', 'A message to the test number still needs to be verified.'],
    ['snapchat', 'سناب شات', 'Snapchat', '#d3a211', 'التطبيق جاهز', 'App registered', 'باقي تأكيد تبديل المفتاح ومعرّفي الشركة وحساب الإعلانات.', 'Confirm the replacement secret, Organization ID and Ad Account ID.'],
    ['tiktok', 'تيك توك', 'TikTok', '#5e5579', 'قيد المراجعة', 'In review', 'ناطرين رد تيك توك على طلب التطبيق.', 'Waiting for TikTok to review the application.'],
    ['youtube', 'يوتيوب', 'YouTube', '#ca5656', 'بانتظار بيانات الحساب', 'Account details needed', 'نحتاج رابط القناة أو Channel ID.', 'Provide the channel link or Channel ID.'],
    ['googleAds', 'إعلانات Google', 'Google Ads', '#4b8b79', 'بانتظار بيانات الحساب', 'Account details needed', 'نحتاج Google Ads Customer ID.', 'Provide the Google Ads Customer ID.'],
  ];

  let results;
  let fetching = false;
  let failed = false;

  function add(parent, tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    parent.append(element);
    return element;
  }

  function render(root) {
    const english = window.PawI18n?.language === 'en';
    const t = (ar, en) => english ? en : ar;
    const locale = english ? 'en-KW' : 'ar-KW';
    const formatNumber = new Intl.NumberFormat(locale);
    const formatTime = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuwait',
    });

    root.replaceChildren();
    const title = add(root, 'div', '', 'section');
    add(title, 'h3', t('إحصائيات المنصات وحالة الربط', 'Platform insights and connection status'));
    const refresh = add(title, 'button', fetching ? t('جاري التحديث…', 'Refreshing…') : t('تحديث Meta', 'Refresh Meta'), 'btn soft');
    refresh.type = 'button';
    refresh.disabled = fetching;
    refresh.addEventListener('click', refreshMetrics);
    if (failed) {
      const error = add(root, 'p', t('تعذر تحميل نتائج Meta. جربي تحديث Meta مرة ثانية.', 'Meta results could not be loaded. Try Refresh Meta again.'), 'hint');
      error.setAttribute('role', 'status');
    }

    const grid = add(root, 'div', '', 'pm-platforms');
    for (const [key, ar, en, color, arStatus, enStatus, arDetail, enDetail] of platforms) {
      const tile = add(grid, 'article', '', 'pm-platform');
      tile.style.setProperty('--pm-color', color);
      add(tile, 'b', t(ar, en));
      if (arStatus) {
        add(tile, 'small', t(arStatus, enStatus));
        add(tile, 'small', t(arDetail, enDetail), 'hint');
        continue;
      }
      const platform = results?.[key];
      const live = platform?.status === 'connected';
      add(tile, 'small', live ? t('متصل', 'Connected') : t('نجح اختبار القراءة', 'Read test passed'));
      const metrics = live ? platform : platform?.snapshot;
      if (metrics) {
        add(tile, 'small', live ? t('آخر جلب من Meta', 'Last fetched from Meta') + ' · ' + formatTime.format(new Date(platform.updatedAt))
          : t('نتائج اختبار محفوظة · ٢٦ نوفمبر ٢٠٢٦', 'Verified test results · 26 Nov 2026'), 'hint');
        if (Number.isFinite(metrics.followers)) {
          add(tile, 'small', t('المتابعون: ', 'Followers: ') + formatNumber.format(metrics.followers));
        }
        if (metrics.daily?.length) {
          add(tile, 'small', key === 'instagram' ? t('الوصول اليومي', 'Daily reach') : t('مشاهدات المحتوى اليومية', 'Daily content views'));
          for (const point of metrics.daily) {
            add(tile, 'small', formatTime.format(new Date(point.endTime)) + ' · ' + formatNumber.format(point.value), 'hint');
          }
        } else if (live) {
          add(tile, 'small', t('ما رجعت Meta أرقامًا يومية للفترة.', 'Meta returned no daily values for this period.'), 'hint');
        }
      }
      if (platform?.status === 'credentials_required') {
        add(tile, 'small', t('التحديث المباشر بانتظار حفظ التفويض على خادم TEST.', 'Live refresh needs authorization saved on TEST.'), 'hint');
      } else if (platform?.status === 'unavailable') {
        add(tile, 'small', t('تعذّر الجلب المباشر. تحققي من صلاحية التفويض.', 'Live refresh failed. Check the authorization.'), 'hint');
      }
    }
  }

  async function refreshMetrics() {
    if (fetching || window.PAWAPP_AUTH?.access?.role !== 'admin') return;
    fetching = true;
    failed = false;
    const current = () => document.querySelector('[data-paw-platform-insights]');
    if (current()) render(current());
    try {
      const { data, error } = await window.PAWAPP_AUTH.client.functions.invoke('concierge-social-insights-test', { body: {} });
      if (error || !data?.instagram || !data?.facebook) throw new Error('Platform insights unavailable');
      results = data;
    } catch {
      failed = true;
    } finally {
      fetching = false;
      if (current()) render(current());
    }
  }

  window.PawPlatformInsights = function(parent) {
    if (window.PAWAPP_AUTH?.access?.role !== 'admin') return;
    const root = add(parent, 'section', '', 'card pm-card');
    root.setAttribute('data-paw-platform-insights', '');
    render(root);
    if (!results && !fetching && !failed) void refreshMetrics();
  };
})();
