(() => {
  'use strict';

  const SUPABASE_URL = 'https://fccvnotgsmxirhztveai.supabase.co';
  const SUPABASE_KEY = 'sb_publishable__bDEEO_UuUc2AZmCNMhQHg_qzjmoSnL';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let mode = 'login';
  let appLoaded = false;

  const el = id => document.getElementById(id);

  function setMessage(message, ok = false) {
    const box = el('authMessage');
    if (!box) return;
    box.textContent = message || '';
    box.className = 'authMsg ' + (message ? (ok ? 'authSuccess' : 'authError') : '');
  }

  function setBusy(busy) {
    const btn = el('authPrimaryBtn');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? 'جاري...' : (mode === 'login' ? 'دخول' : 'تفعيل الحساب');
  }

  function renderMode() {
    const subtitle = el('authSubtitle');
    const btn = el('authPrimaryBtn');
    const switchBtn = el('authModeBtn');
    const password = el('authPassword');

    if (mode === 'login') {
      if (subtitle) subtitle.textContent = 'تسجيل الدخول للموظفين';
      if (btn) btn.textContent = 'دخول';
      if (switchBtn) switchBtn.textContent = 'أول مرة؟ فعّلي الحساب';
      if (password) password.autocomplete = 'current-password';
    } else {
      if (subtitle) subtitle.textContent = 'تفعيل حساب موظف تمت الموافقة عليه';
      if (btn) btn.textContent = 'تفعيل الحساب';
      if (switchBtn) switchBtn.textContent = 'عندي حساب بالفعل';
      if (password) password.autocomplete = 'new-password';
    }
    setMessage('');
  }

  async function verifyAccess(user) {
    const { data, error } = await sb
      .from('test_employee_access')
      .select('id,email,role,is_active,employee_id,auth_user_id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  function loadAppOnce() {
    if (appLoaded) return;
    appLoaded = true;
    const script = document.createElement('script');
    script.src = 'app.js';
    script.async = false;
    script.onerror = () => {
      appLoaded = false;
      setMessage('تعذر تحميل النظام. جربي Refresh.');
    };
    document.body.appendChild(script);
  }

  async function enterApp(session) {
    const access = await verifyAccess(session.user);
    if (!access) {
      await sb.auth.signOut();
      throw new Error('هذا الإيميل ما عنده Access للنظام.');
    }

    window.PAWAPP_AUTH = {
      client: sb,
      session,
      user: session.user,
      access
    };

    const gate = el('authGate');
    if (gate) gate.classList.add('hidden');

    const bar = el('authUserBar');
    const email = el('authUserEmail');
    if (bar) bar.style.display = 'flex';
    if (email) email.textContent = access.email || session.user.email || '';

    loadAppOnce();
  }

  window.pawAuthToggleMode = function() {
    mode = mode === 'login' ? 'activate' : 'login';
    renderMode();
  };

  window.pawAuthSubmit = async function() {
    const email = (el('authEmail')?.value || '').trim().toLowerCase();
    const password = el('authPassword')?.value || '';

    if (!email) {
      setMessage('اكتبي الإيميل.');
      return;
    }
    if (password.length < 8) {
      setMessage('الباسورد لازم يكون 8 أحرف أو أكثر.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      if (mode === 'activate') {
        const { data: approved, error: approvedError } = await sb.rpc('is_test_email_preapproved', { p_email: email });
        if (approvedError) throw approvedError;
        if (!approved) throw new Error('هذا الإيميل ما عنده Access مسبق للنظام.');

        const { data, error } = await sb.auth.signUp({
          email,
          password
        });
        if (error) throw error;

        if (data.session) {
          await enterApp(data.session);
        } else {
          mode = 'login';
          renderMode();
          setMessage('تم إنشاء الحساب. افتحي رسالة التأكيد اللي وصلت للإيميل، وبعدها ارجعي وسجلي دخول.', true);
        }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await enterApp(data.session);
      }
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('Invalid login credentials')) {
        setMessage('الإيميل أو الباسورد غير صحيح.');
      } else if (msg.includes('Email not confirmed')) {
        setMessage('لازم أول شيء تأكدين الإيميل من الرسالة اللي وصلتج.');
      } else if (msg.includes('User already registered')) {
        setMessage('هذا الإيميل مفعّل من قبل. اختاري "عندي حساب بالفعل".');
      } else {
        setMessage(msg || 'تعذر تسجيل الدخول.');
      }
    } finally {
      setBusy(false);
    }
  };


  window.pawAdminCreateEmployee = async function() {
    const access = window.PAWAPP_AUTH?.access;
    if (!access || access.role !== 'admin') {
      alert('Admin فقط');
      return;
    }

    const employeeName = (el('adminEmployeeName')?.value || '').trim();
    const email = (el('adminEmployeeEmail')?.value || '').trim().toLowerCase();
    const password = el('adminEmployeePassword')?.value || '';
    const role = el('adminEmployeeRole')?.value || 'operations';
    const message = el('adminCreateUserMessage');

    if (!employeeName) { if(message) message.textContent='اكتبي اسم الموظف.'; return; }
    if (!email) { if(message) message.textContent='اكتبي الإيميل.'; return; }
    if (password.length < 8) { if(message) message.textContent='الباسورد المؤقت لازم يكون 8 أحرف أو أكثر.'; return; }

    if (message) message.textContent='جاري إنشاء الحساب...';

    let employeeId='';
    try{
      const existing=await sb.from('test_employees').select('id,name').ilike('name',employeeName).limit(1);
      if(!existing.error && existing.data && existing.data[0]) employeeId=existing.data[0].id;
    }catch(e){}

    if(!employeeId){
      const created=await sb.from('test_employees').insert({name:employeeName}).select('id').single();
      if(created.error){
        if(message) message.textContent='تعذر إضافة الموظف: '+created.error.message;
        return;
      }
      employeeId=created.data.id;
    }

    const { data: row, error: rowError } = await sb
      .from('test_employee_access')
      .upsert({
        employee_id: employeeId,
        email,
        role,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' })
      .select('id,email,role,is_active')
      .single();

    if (rowError) {
      if (message) message.textContent='تعذر حفظ الصلاحية: '+rowError.message;
      return;
    }

    const secondary = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    const { data, error } = await secondary.auth.signUp({ email, password });
    if (error) {
      if (String(error.message||'').includes('already registered')) {
        if (message) message.textContent='الإيميل موجود من قبل. تم تحديث الصلاحية فقط.';
      } else {
        if (message) message.textContent='تم حفظ الصلاحية لكن تعذر إنشاء الحساب: '+error.message;
        return;
      }
    } else {
      if (message) message.textContent='تم إنشاء الحساب. الموظف يقدر يدخل بالإيميل والباسورد المؤقت.';
    }

    if (el('adminEmployeePassword')) el('adminEmployeePassword').value='';
    if (el('adminEmployeeName')) el('adminEmployeeName').value='';
    if (el('adminEmployeeEmail')) el('adminEmployeeEmail').value='';
    if (window.renderAdminAccess) window.renderAdminAccess();
  };

  window.pawChangeMyPassword = async function() {
    const newPassword = el('myNewPassword')?.value || '';
    const confirmPassword = el('myConfirmPassword')?.value || '';
    const message = el('myPasswordMessage');

    if (newPassword.length < 8) {
      if (message) message.textContent='الباسورد الجديد لازم يكون 8 أحرف أو أكثر.';
      return;
    }
    if (newPassword !== confirmPassword) {
      if (message) message.textContent='تأكيد الباسورد مو مطابق.';
      return;
    }

    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) {
      if (message) message.textContent='تعذر تغيير الباسورد: '+error.message;
      return;
    }

    if (el('myNewPassword')) el('myNewPassword').value='';
    if (el('myConfirmPassword')) el('myConfirmPassword').value='';
    if (message) message.textContent='تم حفظ الباسورد الجديد بنجاح.';
  };

  window.pawAuthSignOut = async function() {
    await sb.auth.signOut();
    location.reload();
  };

  async function boot() {
    renderMode();

    const { data } = await sb.auth.getSession();
    if (data?.session) {
      try {
        await enterApp(data.session);
        return;
      } catch (e) {
        setMessage(String(e?.message || 'تعذر التحقق من الصلاحية.'));
      }
    }

    const gate = el('authGate');
    if (gate) gate.classList.remove('hidden');
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session && !appLoaded) {
      try {
        await enterApp(session);
      } catch (e) {
        setMessage(String(e?.message || 'تعذر التحقق من الصلاحية.'));
      }
    }
  });

  boot();
})();