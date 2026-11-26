(() => {
  'use strict';

  const platforms = [
    ['instagram', 'إنستغرام', 'Instagram', '#b24d89'],
    ['facebook', 'فيسبوك', 'Facebook', '#3478d4'],
    ['metaAds', 'إعلانات Meta', 'Meta Ads', '#2465ae'],
    ['whatsapp', 'واتساب', 'WhatsApp', '#249366', 'نجح اختبار عينة', 'Sample received', 'باقي تجربة رسالة فعلية على رقم الاختبار.', 'A message to the test number still needs to be verified.'],
    ['snapchat', 'سناب شات', 'Snapchat', '#d3a211', 'التطبيق جاهز', 'App registered', 'باقي تأكيد تبديل المفتاح ومعرّفي الشركة وحساب الإعلانات.', 'Confirm the replacement secret, Organization ID and Ad Account ID.'],
    ['tiktok', 'تيك توك', 'TikTok', '#5e5579', 'قيد المراجعة', 'In review', 'ناطرين رد تيك توك على طلب التطبيق.', 'Waiting for TikTok to review the application.'],
    ['youtube', 'يوتيوب', 'YouTube', '#ca5656', 'بانتظار بيانات الحساب', 'Account details needed', 'نحتاج رابط القناة أو Channel ID.', 'Provide the channel link or Channel ID.'],
    ['googleAds', 'إعلانات Google', 'Google Ads', '#4b8b79', 'بانتظار بيانات الحساب', 'Account details needed', 'نحتاج Google Ads Customer ID.', 'Provide the Google Ads Customer ID.'],
  ];

  let results;
  let fetching = false;
  let failed = false;
  let adPeriod = 'maximum';

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
      if (key === 'metaAds') {
        const connected = platform?.status === 'connected';
        add(tile, 'small', connected ? t('متصل', 'Connected') : t('نجح اختبار القراءة', 'Read test passed'));
        if (connected) {
          add(tile, 'small', t('آخر جلب من Meta', 'Last fetched from Meta') + ' · ' + formatTime.format(new Date(platform.updatedAt)), 'hint');
        } else {
          add(tile, 'small', platform?.status === 'unavailable'
            ? t('تعذر جلب نتائج حملات Paw Ads.', 'Could not load Paw Ads results.')
            : t('الجلب المباشر بانتظار حفظ توكن الإعلانات على TEST.', 'Live refresh needs the ads token on TEST.'), 'hint');
        }
        continue;
      }
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

    const report = add(root, 'section', '', 'pm-card');
    add(report, 'h3', t('نتائج حملات Paw Ads', 'Paw Ads campaign results'));
    const filters = add(report, 'div', '', 'pm-filters');
    const label = add(filters, 'label', t('الفترة', 'Reporting period'));
    const select = add(label, 'select');
    for (const [value, name] of [
      ['maximum', t('السجل المتاح', 'Available history')],
      ['last_30d', t('آخر ٣٠ يوم', 'Last 30 days')],
      ['last_90d', t('آخر ٩٠ يوم', 'Last 90 days')],
    ]) {
      add(select, 'option', name).value = value;
    }
    select.value = adPeriod;
    select.disabled = fetching;
    select.addEventListener('change', () => {
      adPeriod = select.value;
      void refreshMetrics();
    });

    const ads = results?.metaAds;
    if (fetching) {
      add(report, 'p', t('جاري جلب نتائج الحملات…', 'Loading campaign results…'), 'hint');
      return;
    }
    if (ads?.status !== 'connected' || ads.period !== adPeriod) return;
    if (!ads.campaigns.length) {
      add(report, 'p', t('ما رجعت Meta نتائج حملات لهالفترة.', 'Meta returned no campaign results for this period.'), 'hint');
      return;
    }

    const table = add(add(report, 'div', '', 'pm-table'), 'table');
    const header = add(add(table, 'thead'), 'tr');
    for (const title of [
      t('الحملة', 'Campaign'), t('الإنفاق', 'Spend'), t('الظهور', 'Impressions'),
      t('النقرات', 'Clicks'), t('فترة التقرير', 'Report dates'),
    ]) {
      add(header, 'th', title).scope = 'col';
    }
    const body = add(table, 'tbody');
    const formatSpend = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
    const count = value => Number.isFinite(value) ? formatNumber.format(value) : '—';
    for (const campaign of ads.campaigns) {
      const row = add(body, 'tr');
      add(row, 'td', campaign.name || '—');
      add(row, 'td', Number.isFinite(campaign.spend)
        ? formatSpend.format(campaign.spend) + ' ' + (campaign.currency || '')
        : '—');
      add(row, 'td', count(campaign.impressions));
      add(row, 'td', count(campaign.clicks));
      const dates = add(row, 'td', campaign.from && campaign.to ? campaign.from + ' – ' + campaign.to : '—');
      dates.dir = 'ltr';
    }
    if (ads.hasMore) {
      add(report, 'p', t('نعرض أول ٢٥ حملة لهالفترة.', 'Showing the first 25 campaigns for this period.'), 'hint');
    }
  }

  async function refreshMetrics() {
    if (fetching || window.PAWAPP_AUTH?.access?.role !== 'admin') return;
    fetching = true;
    failed = false;
    const current = () => document.querySelector('[data-paw-platform-insights]');
    if (current()) render(current());
    try {
      const { data, error } = await window.PAWAPP_AUTH.client.functions.invoke('concierge-social-insights-test', { body: { adPeriod } });
      if (error || !data?.instagram || !data?.facebook) throw new Error('Platform insights unavailable');
      results = data;
    } catch {
      failed = true;
      if (results) results = { ...results, metaAds: null };
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
