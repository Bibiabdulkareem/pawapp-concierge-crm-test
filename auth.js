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
    script.src = 'finance-entry.js?v=3.24-'+Date.now();
    script.async = false;
    script.onerror = () => {
      appLoaded = false;
      setMessage('تعذر تحميل النظام. جربي Refresh.');
    };
    document.body.appendChild(script);
  }

  function applyReadOnlyUI() {
    const role = document.body.dataset.pawRole || '';
    const readOnly = role === 'read_only';
    const accountant = role === 'accountant';
    const noWrite = readOnly || accountant;

    document.querySelectorAll('[data-p="newcase"], .fab').forEach(node => {
      node.style.display = noWrite ? 'none' : '';
    });

    const blockedActions = [
      'saveCase','saveCaseDetails','saveClientPayment','saveSettlement','saveProvider','saveStaff',
      'saveAppointmentReminder','addCaseFollowup','addProviderService','editProviderService','deleteProvider','deleteProviderService',
      'crmEditCustomer','crmSaveCustomer','crmDeleteCustomer','deleteCaseFromOperations',
      'deleteCaseAttachment','uploadCaseAttachment','completeAppointmentFollowup','setFollowupStatus',
      'openNewCase','openSettlement','openServiceManager'
    ];

    document.querySelectorAll('button[onclick]').forEach(btn => {
      const handler = btn.getAttribute('onclick') || '';
      const blocked = blockedActions.some(name => handler.includes(name + '('));
      if (noWrite && blocked) {
        btn.style.display = 'none';
        btn.dataset.readOnlyHidden = '1';
      } else if (!noWrite && btn.dataset.readOnlyHidden === '1') {
        btn.style.display = '';
        delete btn.dataset.readOnlyHidden;
      }
    });

    document.querySelectorAll('.modalBg input, .modalBg select, .modalBg textarea').forEach(field => {
      const accountantInvoicePin = accountant && field.id === 'attachmentPin';
      // Accountants can enter settlement evidence in the finance action dialog only.
      const accountantSettlementField = accountant && !!field.closest('#financeActionModal');
      if (noWrite && !accountantInvoicePin && !accountantSettlementField) {
        field.disabled = true;
        field.dataset.readOnlyDisabled = '1';
      } else if (field.dataset.readOnlyDisabled === '1') {
        field.disabled = false;
        delete field.dataset.readOnlyDisabled;
      }
    });
  }

  let readOnlyObserver = null;

  function applyRoleUI(access) {
    const isAdmin = access && access.role === 'admin';
    const role = access?.role || '';
    document.querySelectorAll('[data-p="admin"]').forEach(node => {
      node.style.display = isAdmin ? '' : 'none';
    });
    document.querySelectorAll('[data-p="reports"]').forEach(node => {
      node.style.display = ['admin','operations','accountant'].includes(role) ? '' : 'none';
    });
    const adminPage = document.getElementById('admin');
    if (adminPage && !isAdmin) adminPage.classList.remove('active');
    document.body.dataset.pawRole = access?.role || '';

    applyReadOnlyUI();
    if (!readOnlyObserver) {
      readOnlyObserver = new MutationObserver(() => applyReadOnlyUI());
      readOnlyObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  window.pawIsAdmin = function() {
    return window.PAWAPP_AUTH?.access?.role === 'admin';
  };

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

    applyRoleUI(access);
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


  // Use the existing employee record; never create a duplicate by guessing the name.
  window.pawAdminSelectEmployee = async function(employeeId) {
    if (window.PAWAPP_AUTH?.access?.role !== 'admin') return;
    const select = el('adminEmployeeSelect');
    const option = select?.selectedOptions?.[0];
    const name = el('adminEmployeeName');
    const email = el('adminEmployeeEmail');
    const password = el('adminEmployeePassword');
    const role = el('adminEmployeeRole');
    const message = el('adminCreateUserMessage');
    if (name) name.value = employeeId && option ? option.textContent.trim() : '';
    if (email) { email.value = ''; email.readOnly = false; }
    if (password) password.value = '';
    if (role) role.value = 'operations';
    if (message) message.textContent = '';
    if (!employeeId) return;
    const {data,error} = await sb.from('test_employee_access')
      .select('id,email,role,is_active,auth_user_id')
      .eq('employee_id', employeeId).limit(2);
    if (select?.value !== employeeId) return;
    if (error || (data||[]).length > 1) {
      if (message) message.textContent = 'تعذر قراءة حساب الموظف، راجعي الإدارة.';
      return;
    }
    const a = (data||[])[0];
    if (a) {
      if (email) { email.value = a.email||''; email.readOnly = !!a.auth_user_id; }
      if (role) role.value = a.role||'operations';
      if (message) message.textContent = a.auth_user_id
        ? 'هذا الموظف عنده حساب دخول. تقدرين تغيرين الصلاحية، لكن الباسورد يتغيّر من حساب الموظف نفسه.'
        : 'الصلاحية محفوظة، لكن حساب الدخول مو مفعّل. اكتبي باسورد مؤقت للتفعيل.';
    } else if (message) {
      message.textContent = 'اختاري الإيميل والصلاحية وحطي باسورد مؤقت لهذا الموظف.';
    }
  };

  window.pawAdminCreateEmployee = async function() {
    if (window.PAWAPP_AUTH?.access?.role !== 'admin') return alert('Admin فقط');
    const employeeId = el('adminEmployeeSelect')?.value || '';
    const selected = el('adminEmployeeSelect')?.selectedOptions?.[0];
    const email = (el('adminEmployeeEmail')?.value || '').trim().toLowerCase();
    const password = el('adminEmployeePassword')?.value || '';
    const role = el('adminEmployeeRole')?.value || '';
    const message = el('adminCreateUserMessage');
    const button = el('adminCreateUserButton');
    function status(value) { if (message) message.textContent = value; }
    if (!employeeId || !selected || !selected.textContent.trim()) return status('اختاري الموظف من القائمة أولاً.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return status('اكتبي إيميل صحيح للموظف.');
    if (!['operations','accountant','read_only','admin'].includes(role)) return status('الصلاحية غير صحيحة.');
    if (button?.disabled) return;
    if (button) button.disabled = true;
    try {
      status('جاري فحص بيانات الموظف...');
      const employee = await sb.from('test_employees').select('id,name')
        .eq('id',employeeId).maybeSingle();
      if (employee.error || !employee.data) throw new Error('الموظف غير موجود. حدّثي القائمة.');
      const own = await sb.from('test_employee_access')
        .select('id,email,role,is_active,auth_user_id')
        .eq('employee_id',employeeId).limit(2);
      if (own.error) throw own.error;
      if ((own.data||[]).length > 1) throw new Error('يوجد أكثر من حساب لهذا الموظف، يلزم مراجعة الإدارة.');
      const existing = (own.data||[])[0] || null;

      // Never move another employee's login to this employee, even when email is identical.
      const others = await sb.from('test_employee_access')
        .select('employee_id,email').ilike('email',email).limit(3);
      if (others.error) throw others.error;
      if ((others.data||[]).some(a=>String(a.employee_id)!==String(employeeId)))
        throw new Error('الإيميل مستخدم لحساب موظف آخر؛ اختاري إيميل مختلف.');

      if (existing?.auth_user_id) {
        if ((existing.email||'').toLowerCase() !== email)
          throw new Error('لا يمكن تغيير إيميل حساب مفعّل من هنا؛ يلزم تغيير الإيميل بحساب المستخدم.');
        if (password) throw new Error('الحساب مفعّل مسبقاً. امسحي الباسورد المؤقت؛ تغيير الباسورد يتم من حساب الموظف.');
        const updated = await sb.from('test_employee_access')
          .update({role,is_active:true,updated_at:new Date().toISOString()})
          .eq('id',existing.id).select('id,role').single();
        if (updated.error) throw updated.error;
        status('تم تحديث صلاحية '+employee.data.name+' بنجاح. حساب الدخول الحالي والباسورد ما تغيروا.');
      } else {
        if (password.length < 8) throw new Error('الباسورد المؤقت لازم يكون 8 أحرف أو أكثر.');
        let result;
        if (existing) {
          result = await sb.from('test_employee_access')
            .update({email,role,is_active:true,updated_at:new Date().toISOString()})
            .eq('id',existing.id).select('id').single();
        } else {
          result = await sb.from('test_employee_access')
            .insert({employee_id:employeeId,email,role,is_active:true})
            .select('id').single();
        }
        if (result.error) throw result.error;

        // Sign-up with an isolated client leaves the Admin's own session untouched.
        // Credentials are sent to Supabase Auth, not stored in employee/access rows.
        const secondary = window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
          auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
        });
        const signup = await secondary.auth.signUp({email,password});
        if (signup.error) {
          status('تم حفظ الصلاحية لكن لم يتم تفعيل حساب الدخول: '+signup.error.message+
            '. الحساب يظل بانتظار التفعيل.');
          return;
        }
        const checked = await sb.from('test_employee_access')
          .select('auth_user_id').eq('id',result.data.id).maybeSingle();
        if (checked.error) throw checked.error;
        if (!checked.data?.auth_user_id) {
          status('تم حفظ الصلاحية، لكن حساب الدخول لم يرتبط بعد. جربي تفعيل الحساب من شاشة الدخول أو راجعي رسالة التأكيد.');
          return;
        }
        status('تم تفعيل حساب '+employee.data.name+' بالصلاحية المحددة. يمكنها تسجيل الدخول بالإيميل والباسورد المؤقت.');
      }
      if (el('adminEmployeePassword')) el('adminEmployeePassword').value='';
      if (window.renderAdminAccess) await window.renderAdminAccess();
    } catch (err) {
      status('تعذر إكمال العملية: '+String(err?.message||err));
    } finally {
      if (button) button.disabled = false;
    }
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