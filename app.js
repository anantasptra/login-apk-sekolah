/**
 * Aplikasi Absensi Sekolah - Cyber Professional Edition
 * Full-featured with Operator, Guru, Siswa management
 */
window.app = {
    // === CONFIGURATION ===
    // Menggunakan konfigurasi asli dari user
    firebaseConfig: {
        apiKey: "AIzaSyDgwshBBoIDHxIKUbGlcXtGzAwmaV1Nx9E",
        authDomain: "website-cea34.firebaseapp.com",
        databaseURL: "https://website-cea34-default-rtdb.asia-southeast1.firebasedatabase.app/",
        projectId: "website-cea34",
        storageBucket: "website-cea34.firebasestorage.app",
        messagingSenderId: "75357539166",
        appId: "1:75357539166:web:dd81111c5fff0a0d631dcf",
        measurementId: "G-QEHZT5S7CX"
    },

    state: {
        currentUser: null, currentRole: null, targetRole: null,
        isCameraOn: false, scanner: null, history: [],
        facingMode: "environment",
        schoolConfig: { name: "Nama Sekolah Belum Diatur" },
        teachers: {}, students: {},
        academic: { semesters: [], classes: [], subjects: [], masterSubjects: [] },
        sessions: [],
        materials: [], assignments: [], submissions: [],
        activeSubjectId: null, currentHubId: null, currentSessionId: null
    },

    init() {
        this.initFirebase();
        this.registerServiceWorker();
    },

    initFirebase() {
        try {
            if (this.firebaseConfig.apiKey === "YOUR_API_KEY") {
                console.warn("Firebase belum dikonfigurasi. Menggunakan mode Lokal sementara.");
                this.loadLocalSettings();
                this.applySchoolInfoToUI();
                return;
            }
            firebase.initializeApp(this.firebaseConfig);
            this.db = firebase.database();
            this.setupSync();
        } catch (e) {
            console.error("Firebase Init Error:", e);
            this.loadLocalSettings();
        }
    },

    setupSync() {
        const dbRef = this.db.ref('school_data');
        
        // Cek jika cloud kosong, migrasikan data lokal ke cloud
        dbRef.once('value').then(snapshot => {
            if (!snapshot.exists()) {
                console.log("Cloud kosong, memigrasikan data lokal...");
                this.loadLocalSettings();
                this.syncToCloud();
            }
        });

        // Listen for Real-time Updates
        dbRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.state.schoolConfig = data.schoolConfig || this.state.schoolConfig;
                this.state.teachers = data.teachers || {};
                this.state.students = data.students || {};
                this.state.academic = data.academic || this.state.academic;
                this.state.sessions = data.sessions || [];
                this.state.materials = data.materials || [];
                this.state.assignments = data.assignments || [];
                this.state.submissions = data.submissions || [];
                this.state.history = data.history || [];
                
                this.applySchoolInfoToUI();
                // Refresh UI if on dashboard
                if (this.state.currentRole === 'operator') {
                    this.renderTeacherList();
                    this.renderStudentAccountList();
                    this.renderAcademicLists();
                } else if (this.state.currentRole === 'teacher') {
                    this.renderSubjectGrid('guru');
                } else if (this.state.currentRole === 'siswa') {
                    this.renderSubjectGrid('siswa');
                }
            }
        });
    },

    syncToCloud() {
        if (!this.db) return;
        const dataToSync = {
            schoolConfig: this.state.schoolConfig,
            teachers: this.state.teachers,
            students: this.state.students,
            academic: this.state.academic,
            sessions: this.state.sessions,
            materials: this.state.materials,
            assignments: this.state.assignments,
            submissions: this.state.submissions,
            history: this.state.history
        };
        this.db.ref('school_data').set(dataToSync);
    },

    loadLocalSettings() {
        try {
            const c = localStorage.getItem('absensi_school_config');
            if (c) this.state.schoolConfig = JSON.parse(c);
            const t = localStorage.getItem('absensi_teachers_data');
            if (t) this.state.teachers = JSON.parse(t);
            const s = localStorage.getItem('absensi_students_accounts');
            if (s) this.state.students = JSON.parse(s);
            const a = localStorage.getItem('absensi_academic_data');
            if (a) this.state.academic = JSON.parse(a);
            const mat = localStorage.getItem('absensi_materials');
            if (mat) this.state.materials = JSON.parse(mat);
            const ass = localStorage.getItem('absensi_assignments');
            if (ass) this.state.assignments = JSON.parse(ass);
            const subm = localStorage.getItem('absensi_submissions');
            if (subm) this.state.submissions = JSON.parse(subm);
            const h = localStorage.getItem('absensi_history');
            if (h) this.state.history = JSON.parse(h);
            const ses = localStorage.getItem('absensi_sessions');
            if (ses) this.state.sessions = JSON.parse(ses);
        } catch (e) { console.error("Load local error:", e); }
    },

    saveSchoolConfig() {
        const name = document.getElementById('opt-school-name').value.trim();
        if (!name) return alert("Nama sekolah tidak boleh kosong!");
        this.state.schoolConfig.name = name;
        this.syncToCloud();
        localStorage.setItem('absensi_school_config', JSON.stringify(this.state.schoolConfig));
        this.applySchoolInfoToUI();
        this.showToast("Konfigurasi Sekolah Disimpan ke Cloud!", "success");
    },

    saveSessions() { this.syncToCloud(); localStorage.setItem('absensi_sessions', JSON.stringify(this.state.sessions)); },
    saveMaterials() { this.syncToCloud(); localStorage.setItem('absensi_materials', JSON.stringify(this.state.materials)); },
    saveAssignments() { this.syncToCloud(); localStorage.setItem('absensi_assignments', JSON.stringify(this.state.assignments)); },
    saveSubmissions() { this.syncToCloud(); localStorage.setItem('absensi_submissions', JSON.stringify(this.state.submissions)); },
    saveAcademic() { this.syncToCloud(); localStorage.setItem('absensi_academic_data', JSON.stringify(this.state.academic)); },
    saveStudents() { this.syncToCloud(); localStorage.setItem('absensi_students_accounts', JSON.stringify(this.state.students)); },
    saveTeachers() { this.syncToCloud(); localStorage.setItem('absensi_teachers_data', JSON.stringify(this.state.teachers)); },
    saveHistory() { this.syncToCloud(); localStorage.setItem('absensi_history', JSON.stringify(this.state.history)); },

    // === SECURITY UTILS ===
    encrypt(text) {
        if (!text) return "";
        return CryptoJS.AES.encrypt(text, 'secret-key-123').toString();
    },
    decrypt(ciphertext) {
        if (!ciphertext) return "";
        try {
            const bytes = CryptoJS.AES.decrypt(ciphertext, 'secret-key-123');
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch (e) { return ciphertext; } // Fallback if not encrypted
    },

    applySchoolInfoToUI() {
        const schoolName = this.state.schoolConfig.name || "ABSENSI SEKOLAH DIGITAL";
        ['moving-school-name', 'moving-school-guru', 'moving-school-name-opt', 'moving-school-siswa'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = schoolName.toUpperCase();
        });
        const optInput = document.getElementById('opt-school-name');
        if (optInput) optInput.value = this.state.schoolConfig.name || '';
    },

    // === NAVIGATION ===
    showView(viewId) {
        document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.style.display = 'none'; });
        const target = document.getElementById(`view-${viewId}`);
        if (target) { target.classList.add('active'); target.style.display = 'block'; }
        const branding = document.querySelector('.branding');
        if (branding) {
            branding.style.display = ['landing','login','siswa'].includes(viewId) ? 'block' : 'none';
        }
        this.stopAllScanners();
    },
    showDashboardSiswa() { this.showView('dashboard-siswa'); },

    showLanding() { this.showView('landing'); },
    showSiswa() {
        this.showView('siswa');
    },
    showLoginGuru() { this.prepareLogin('teacher', 'Guru'); },
    showLoginOperator() { this.prepareLogin('operator', 'Administrator'); },

    prepareLogin(role, label) {
        this.state.targetRole = role;
        document.getElementById('login-title').innerText = `Akses ${label}`;
        document.getElementById('login-role-tag').innerText = label;
        document.getElementById('login-id').value = '';
        document.getElementById('login-pwd').value = '';
        this.showView('login');
    },

    // === LOGIN HANDLERS ===
    handleLogin() {
        const user = document.getElementById('login-id').value.trim();
        const pass = document.getElementById('login-pwd').value.trim();
        if (!user || !pass) return alert("Username dan Password wajib diisi!");
        const role = this.state.targetRole;

        if (role === 'operator') {
            if (user.toLowerCase() === 'admin' && pass === 'admin123') {
                this.loginSuccess('admin', 'operator');
                this.renderTeacherList();
                this.renderStudentAccountList();
                this.renderAcademicLists();
                this.applySchoolInfoToUI();
                this.showView('dashboard-operator');
            } else alert("Login Operator Gagal.");
        } else {
            const teacherKey = Object.keys(this.state.teachers).find(k => k.toLowerCase() === user.toLowerCase());
            const t = teacherKey ? this.state.teachers[teacherKey] : null;
            if (t && this.decrypt(t.password) === pass) {
                this.loginSuccess(teacherKey, 'teacher');
                const img = document.getElementById('teacher-profile-img');
                if (img) img.src = t.photo || 'https://via.placeholder.com/70?text=Guru';
                document.getElementById('welcome-text').innerText = `Selamat Datang, ${teacherKey}`;
                this.renderSubjectGrid('guru');
                this.showView('dashboard-guru');
            } else alert("Username atau Password Salah.");
        }
    },

    loginSuccess(user, role) {
        this.state.currentUser = user;
        this.state.currentRole = role;
        this.applySchoolInfoToUI();
    },

    logout() { this.state.currentUser = null; this.state.currentRole = null; this.showLanding(); },

    handleSiswaLogin() {
        const nim = document.getElementById('siswa-nim-login').value.trim();
        const pwd = document.getElementById('siswa-pwd-login').value.trim();
        if (!nim || !pwd) return alert("NISN dan Password wajib diisi!");
        if (this.state.students[nim] && this.decrypt(this.state.students[nim].password) === pwd) {
            this.state.currentUser = nim;
            this.state.currentRole = 'siswa';
            this.showSiswaDashboard();
        } else alert("NISN atau Password Salah!");
    },


    showSiswaDashboard() {
        const student = this.state.students[this.state.currentUser];
        const name = student ? student.name : this.state.currentUser;
        document.getElementById('siswa-name-display').innerText = `Halo, ${name}`;
        document.getElementById('siswa-nim-display').innerText = `NISN: ${this.state.currentUser} • Kelas: ${student?.classId || '-'}`;
        const img = document.getElementById('siswa-profile-img');
        if (img && student?.photo) img.src = student.photo;
        this.applySchoolInfoToUI();
        this.renderSubjectGrid('siswa');
        this.showView('dashboard-siswa');
    },

    logoutSiswa() {
        this.state.currentUser = null; this.state.currentRole = null;
        this.showSiswa();
    },

    // === PHOTO UPLOAD ===
    handlePhotoUpload(event, role) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            if (role === 'siswa') {
                this.state.students[this.state.currentUser].photo = dataUrl;
                this.saveStudents();
                document.getElementById('siswa-profile-img').src = dataUrl;
            } else if (role === 'teacher') {
                this.state.teachers[this.state.currentUser].photo = dataUrl;
                this.saveTeachers();
                document.getElementById('teacher-profile-img').src = dataUrl;
            }
        };
        reader.readAsDataURL(file);
    },

    // === SUBJECT GRID ===
    renderSubjectGrid(role) {
        const gridId = role === 'siswa' ? 'siswa-subject-grid' : 'active-subject-grid';
        const container = document.getElementById(gridId);
        if (!container) return;
        const icons = ['fa-calculator','fa-flask','fa-globe','fa-laptop-code','fa-palette','fa-language','fa-atom','fa-dna'];
        
        let subs = role === 'siswa'
            ? this.state.academic.subjects.filter(s => s.classId === this.state.students[this.state.currentUser]?.classId)
            : this.state.academic.subjects.filter(s => (s.teacherIds || [s.teacherId]).includes(this.state.currentUser));

        // Group by Name + Class + Semester for display
        const grouped = [];
        const map = new Map();
        subs.forEach(s => {
            const key = `${s.name}-${s.classId}-${s.semesterId}`;
            if (map.has(key)) {
                const existing = map.get(key);
                // Merge teachers
                const tArray = existing.teacherIds || [existing.teacherId];
                const newT = s.teacherIds || [s.teacherId];
                newT.forEach(t => { if(!tArray.includes(t)) tArray.push(t); });
                existing.teacherIds = tArray;
                // We'll use the first ID for the hub link, but we'll need to be careful with sessions
                // For a truly merged experience, we'd need to merge the actual data.
                // But for display, this is what the user asked.
            } else {
                const clone = JSON.parse(JSON.stringify(s));
                if (!clone.teacherIds) clone.teacherIds = [clone.teacherId];
                map.set(key, clone);
                grouped.push(clone);
            }
        });

        container.innerHTML = grouped.map((sub, i) => {
            const icon = icons[i % icons.length];
            // Count sessions for all subjects with this key
            const sessionCount = this.state.sessions.filter(ses => {
                const parentSub = this.state.academic.subjects.find(as => as.id === ses.subjectId);
                return parentSub && parentSub.name === sub.name && parentSub.classId === sub.classId && parentSub.semesterId === sub.semesterId;
            }).length;

            const teacherDisplay = sub.teacherIds.join(', ');
            return `<div class="subject-card" onclick="window.app.openSubjectHub('${sub.id}')">
                <i class="fas ${icon}"></i>
                <h3>${sub.name}</h3>
                <p class="text-dim">${sub.classId} • ${sub.semesterId}<br>Guru: ${teacherDisplay}</p>
                <span class="badge badge-success mt-2">${sessionCount} Sesi</span>
            </div>`;
        }).join('');
    },

    // === SUBJECT HUB ===
    getRelatedSubjects(id) {
        const sub = this.state.academic.subjects.find(s => s.id === id);
        if (!sub) return [];
        return this.state.academic.subjects.filter(s => s.name === sub.name && s.classId === sub.classId && s.semesterId === sub.semesterId);
    },
    openSubjectHub(id) {
        this.state.currentHubId = id;
        this.state.activeSubjectId = id;
        const sub = this.state.academic.subjects.find(s => s.id === id);
        if (!sub) return;
        const related = this.getRelatedSubjects(id);
        const teachers = [...new Set(related.flatMap(s => s.teacherIds || [s.teacherId]))];
        const teacherDisplay = teachers.join(', ');
        
        document.getElementById('hub-subject-name').innerText = sub.name;
        document.getElementById('hub-semester-info').innerText = `${sub.classId} • ${sub.semesterId} • Guru: ${teacherDisplay}`;
        document.getElementById('subject-hub-overlay').style.display = 'flex';
        this.switchHubTab('sesi');
    },
    closeSubjectHub() { document.getElementById('subject-hub-overlay').style.display = 'none'; },
    switchHubTab(tab) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        const sec = document.getElementById(`hub-sec-${tab}`);
        if (sec) sec.classList.add('active');
        document.querySelectorAll('.hub-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.hub-tab').forEach(t => { if(t.dataset.tab===tab) t.classList.add('active'); });
        if (tab === 'sesi') this.renderSessions();
        if (tab === 'materi') this.renderMaterials();
        if (tab === 'tugas') this.renderAssignments();
        if (tab === 'siswa') this.renderHubSiswa();
        if (tab === 'rekap') this.renderHubRekap();
    },
    // === SESSION SYSTEM ===
    createSession() {
        const dateInput = document.getElementById('session-date-input');
        if (!dateInput || !dateInput.value) return alert('Pilih tanggal!');
        const subId = this.state.currentHubId;
        const exists = this.state.sessions.find(s => s.subjectId === subId && s.date === dateInput.value);
        if (exists) return alert('Sesi pada tanggal ini sudah ada!');
        const d = new Date(dateInput.value);
        const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
        const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
        this.state.sessions.push({
            id: 'ses-'+Date.now(), subjectId: subId, date: dateInput.value,
            dayName: days[d.getDay()], dayNum: d.getDate(), monthName: months[d.getMonth()], year: d.getFullYear(),
            displayDate: `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
        });
        this.saveSessions(); dateInput.value = ''; this.renderSessions();
    },
    deleteSession(id) {
        if (!confirm('Hapus sesi ini beserta data absensinya?')) return;
        this.state.sessions = this.state.sessions.filter(s => s.id !== id);
        this.state.history = this.state.history.filter(h => h.sessionId !== id);
        this.saveSessions(); this.saveHistory(); this.renderSessions();
    },
    renderSessions() {
        const container = document.getElementById('session-list-container');
        if (!container) return;
        const ctrl = document.getElementById('teacher-session-control');
        if (ctrl) ctrl.style.display = this.state.currentRole === 'teacher' ? 'block' : 'none';
        
        const related = this.getRelatedSubjects(this.state.currentHubId);
        const relIds = related.map(s => s.id);
        const sessions = this.state.sessions.filter(s => relIds.includes(s.subjectId)).sort((a,b) => b.date.localeCompare(a.date));
        if (!sessions.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times" style="font-size:2.5rem;color:var(--text-muted);margin-bottom:1rem;"></i><p class="text-muted">Belum ada sesi absensi</p></div>'; return; }
        const isTeacher = this.state.currentRole === 'teacher';
        container.innerHTML = sessions.map(ses => {
            const count = this.state.history.filter(h => h.sessionId === ses.id).length;
            const delBtn = isTeacher ? `<button class="session-btn session-btn-delete" title="Hapus" onclick="window.app.deleteSession('${ses.id}')"><i class="fas fa-trash"></i></button>` : '';
            const qrBtn = isTeacher ? `<button class="session-btn session-btn-qr" title="QR Absensi" onclick="window.app.openSessionQR('${ses.id}')"><i class="fas fa-qrcode"></i></button>` : '';
            const manBtn = isTeacher ? `<button class="session-btn session-btn-manual" title="Absen Manual" onclick="window.app.openManualAbsen('${ses.id}')"><i class="fas fa-arrow-right"></i></button>` : '';
            return `<div class="session-row"><div class="session-date-info"><div class="session-date-badge"><span class="day-num">${ses.dayNum}</span><span>${ses.monthName}</span></div><div class="session-date-text"><h4>${ses.displayDate}</h4><p class="session-count">${count} siswa tercatat</p></div></div><div class="session-actions">${qrBtn}${manBtn}${delBtn}</div></div>`;
        }).join('');
    },
    openSessionQR(sessionId) {
        this.state.currentSessionId = sessionId;
        const overlay = document.getElementById('fullscreen-qr-overlay');
        overlay.style.display = 'flex';
        const canvas = document.getElementById('fullscreen-qr-canvas');
        // Clear previous
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Render QR (using the new library 'QRCode' from script)
        setTimeout(() => {
            try {
                QRCode.toCanvas(canvas, sessionId, {
                    width: 500,
                    margin: 2,
                    color: { dark: "#000000", light: "#ffffff" }
                }, (error) => {
                    if (error) console.error('QR Error:', error);
                });
            } catch(e) { console.error('QR Execution Error:', e); }
        }, 100);
    },
    // === MANUAL ATTENDANCE ===
    openManualAbsen(sessionId) {
        this.state.currentSessionId = sessionId;
        const ses = this.state.sessions.find(s => s.id === sessionId);
        const sub = this.state.academic.subjects.find(s => s.id === ses?.subjectId);
        if (!ses || !sub) return;
        document.getElementById('manual-session-info').innerText = `${sub.name} • ${ses.displayDate}`;
        document.getElementById('manual-absen-overlay').style.display = 'flex';
        const saveBtn = document.querySelector('#manual-absen-overlay .btn-success');
        if (saveBtn) saveBtn.style.display = 'block';
        const body = document.getElementById('manual-absen-body');
        const students = Object.entries(this.state.students).filter(([,s]) => s.classId === sub.classId);
        const sessionRecords = this.state.history.filter(h => h.sessionId === sessionId);
        
        body.innerHTML = students.map(([nim,s],i) => {
            const rec = sessionRecords.find(r => r.nim === nim);
            const scanned = rec && rec.source === 'qr';
            const status = rec ? rec.status : '';
            const rowClass = scanned ? '' : 'row-not-scanned';
            
            const renderRadio = (val) => {
                const isChecked = status === val ? 'checked' : (!status && val === 'hadir' && scanned ? 'checked' : '');
                return `<td class="text-center">
                    <label class="status-radio-container">
                        <input type="radio" name="status-${nim}" value="${val}" ${isChecked} data-nim="${nim}">
                        <span class="radio-mark"></span>
                    </label>
                </td>`;
            };

            return `
                <tr class="${rowClass}">
                    <td>${i+1}</td>
                    <td><div style="font-weight:700;">${s.name || '-'}</div>${scanned ? '<span class="badge-qr"><i class="fas fa-qrcode"></i> Terverifikasi</span>' : ''}</td>
                    <td class="text-muted small">${nim}</td>
                    ${renderRadio('hadir')}
                    ${renderRadio('terlambat')}
                    ${renderRadio('izin')}
                    ${renderRadio('sakit')}
                    ${renderRadio('alpa')}
                </tr>
            `;
        }).join('') || '<tr><td colspan="8" class="text-center text-muted">Tidak ada siswa</td></tr>';
    },
    closeManualAbsen() { document.getElementById('manual-absen-overlay').style.display = 'none'; },
    saveManualAbsen() {
        const sessionId = this.state.currentSessionId;
        const ses = this.state.sessions.find(s => s.id === sessionId);
        const sub = this.state.academic.subjects.find(s => s.id === ses?.subjectId);
        if (!ses || !sub) return;
        
        // Get all unique NIMs from radios
        const nims = [...new Set([...document.querySelectorAll('#manual-absen-body input[type="radio"]')].map(r => r.dataset.nim))];
        
        nims.forEach(nim => {
            const selected = document.querySelector(`input[name="status-${nim}"]:checked`);
            if (selected) {
                const status = selected.value;
                const existing = this.state.history.find(h => h.sessionId === sessionId && h.nim === nim);
                if (existing) {
                    existing.status = status;
                    // If manually changed, keep source if it was QR? Or change to manual? 
                    // Usually we keep QR as source for record, but update status.
                } else {
                    this.state.history.push({
                        sessionId, subjectId: sub.id, nim, status, source: 'manual', 
                        date: ses.date, displayTime: ses.displayDate, subjectName: sub.name, time: new Date().toISOString()
                    });
                }
            }
        });
        this.saveHistory(); alert('Absensi berhasil disimpan!'); this.closeManualAbsen(); this.renderSessions();
    },
    renderHubSiswa() {
        const body = document.getElementById('hub-siswa-body'); if (!body) return;
        const related = this.getRelatedSubjects(this.state.currentHubId);
        if (related.length === 0) return;
        const sub = related[0];
        const students = Object.entries(this.state.students).filter(([,s]) => s.classId === sub.classId);
        const teachers = [...new Set(related.flatMap(s => s.teacherIds || [s.teacherId]))];
        const teacherDisplay = teachers.join(', ');
        
        body.innerHTML = students.map(([nim,s]) => {
            const photo = s.photo || 'https://via.placeholder.com/40?text=S';
            return `<tr>
                <td><img src="${photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"></td>
                <td>${s.name || nim}</td>
                <td>${nim}</td>
                <td><span class="badge badge-primary">${teacherDisplay}</span></td>
            </tr>`;
        }).join('') || '<tr><td colspan="4" class="text-center text-muted">Belum ada siswa</td></tr>';
    },
    renderHubRekap() {
        const body = document.getElementById('hub-rekap-body');
        const statsEl = document.getElementById('rekap-stats-overview');
        const sub = this.state.academic.subjects.find(s => s.id === this.state.currentHubId); if (!sub || !body) return;
        const students = Object.entries(this.state.students).filter(([,s]) => s.classId === sub.classId);
        const allRecs = this.state.history.filter(h => h.subjectId === sub.id);
        const totals = {hadir:0,terlambat:0,izin:0,sakit:0,alpa:0};
        allRecs.forEach(r => { if(totals[r.status]!==undefined) totals[r.status]++; });
        if(statsEl) statsEl.innerHTML = Object.entries(totals).map(([k,v])=>`<div class="rekap-stat-card"><div class="stat-number stat-${k}">${v}</div><div class="stat-label">${k}</div></div>`).join('');
        body.innerHTML = students.map(([nim]) => {
            const recs = allRecs.filter(r => r.nim === nim);
            const c = {hadir:0,terlambat:0,izin:0,sakit:0,alpa:0};
            recs.forEach(r => { if(c[r.status]!==undefined) c[r.status]++; });
            return `<tr><td>${nim}</td><td>${nim}</td><td class="status-hadir">${c.hadir}</td><td class="status-terlambat">${c.terlambat}</td><td class="status-izin">${c.izin}</td><td class="status-sakit">${c.sakit}</td><td class="status-alpa">${c.alpa}</td></tr>`;
        }).join('') || '<tr><td colspan="7" class="text-center text-muted">Belum ada data</td></tr>';
    },

    // === MATERI SYSTEM ===
    addMaterial() {
        const title = document.getElementById('materi-title-input').value.trim();
        const content = document.getElementById('materi-content-input').value.trim();
        const fileInput = document.getElementById('materi-file-input');
        if (!title || !content) return alert("Judul dan Konten wajib diisi!");
        
        const save = (fileData = null) => {
            this.state.materials.push({
                id: 'mat-' + Date.now(), subjectId: this.state.currentHubId,
                teacherId: this.state.currentUser, title, content, 
                file: fileData, date: new Date().toISOString()
            });
            this.saveMaterials();
            document.getElementById('materi-title-input').value = '';
            document.getElementById('materi-content-input').value = '';
            document.getElementById('materi-file-input').value = '';
            this.renderMaterials();
        };

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => save({ name: file.name, data: e.target.result, type: file.type });
            reader.readAsDataURL(file);
        } else save();
    },
    deleteMaterial(id) {
        if (!confirm('Hapus materi ini?')) return;
        this.state.materials = this.state.materials.filter(m => m.id !== id);
        this.saveMaterials(); this.renderMaterials();
    },
    renderMaterials() {
        const container = document.getElementById('materi-list-container');
        if (!container) return;
        const ctrl = document.getElementById('teacher-materi-control');
        ctrl.style.display = this.state.currentRole === 'teacher' ? 'block' : 'none';
        
        const related = this.getRelatedSubjects(this.state.currentHubId);
        const relIds = related.map(s => s.id);
        const list = this.state.materials.filter(m => relIds.includes(m.subjectId)).sort((a,b) => b.date.localeCompare(a.date));
        
        const isTeacher = this.state.currentRole === 'teacher';
        container.innerHTML = list.map(m => {
            const fileHtml = m.file ? `<div class="mt-2"><a href="${m.file.data}" download="${m.file.name}" class="btn btn-secondary" style="width:auto; font-size:0.8rem;"><i class="fas fa-download"></i> Download: ${m.file.name}</a></div>` : '';
            return `
                <div class="card mb-3 p-4">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h4 style="margin:0; color:var(--grad-purple);">${m.title}</h4>
                            <small class="text-dim">${new Date(m.date).toLocaleString('id-ID')}</small>
                        </div>
                        ${isTeacher ? `<button class="btn btn-danger" style="width:auto; padding:0.4rem 0.8rem;" onclick="window.app.deleteMaterial('${m.id}')"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                    <div class="mt-3" style="white-space: pre-wrap; font-size:0.9rem;">${m.content}</div>
                    ${fileHtml}
                </div>
            `;
        }).join('') || '<p class="text-muted text-center">Belum ada materi</p>';
    },

    // === TUGAS SYSTEM ===
    addAssignment() {
        const title = document.getElementById('tugas-title-input').value.trim();
        const desc = document.getElementById('tugas-desc-input').value.trim();
        const deadline = document.getElementById('tugas-deadline-input').value;
        const fileInput = document.getElementById('tugas-file-input');
        if (!title || !desc || !deadline) return alert("Judul, Deskripsi, dan Deadline wajib diisi!");
        
        const save = (fileData = null) => {
            this.state.assignments.push({
                id: 'tgs-' + Date.now(), subjectId: this.state.currentHubId,
                teacherId: this.state.currentUser, title, desc, deadline, 
                file: fileData, date: new Date().toISOString()
            });
            this.saveAssignments();
            document.getElementById('tugas-title-input').value = '';
            document.getElementById('tugas-desc-input').value = '';
            document.getElementById('tugas-deadline-input').value = '';
            document.getElementById('tugas-file-input').value = '';
            this.renderAssignments();
        };

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => save({ name: file.name, data: e.target.result, type: file.type });
            reader.readAsDataURL(file);
        } else save();
    },
    deleteAssignment(id) {
        if (!confirm('Hapus tugas ini beserta semua pengumpulannya?')) return;
        this.state.assignments = this.state.assignments.filter(a => a.id !== id);
        this.state.submissions = this.state.submissions.filter(s => s.assignmentId !== id);
        this.saveAssignments(); this.saveSubmissions(); this.renderAssignments();
    },
    renderAssignments() {
        const container = document.getElementById('tugas-list-container');
        if (!container) return;
        const ctrl = document.getElementById('teacher-tugas-control');
        ctrl.style.display = this.state.currentRole === 'teacher' ? 'block' : 'none';
        
        const related = this.getRelatedSubjects(this.state.currentHubId);
        const relIds = related.map(s => s.id);
        const list = this.state.assignments.filter(a => relIds.includes(a.subjectId)).sort((a,b) => b.date.localeCompare(a.date));
        
        const isTeacher = this.state.currentRole === 'teacher';
        const studentId = this.state.currentUser;

        container.innerHTML = list.map(a => {
            const submission = this.state.submissions.find(s => s.assignmentId === a.id && s.studentId === studentId);
            const submissionsCount = this.state.submissions.filter(s => s.assignmentId === a.id).length;
            const deadlineDate = new Date(a.deadline);
            const isLate = new Date() > deadlineDate;

            const fileHtml = a.file ? `<div class="mt-2"><a href="${a.file.data}" download="${a.file.name}" class="btn btn-secondary" style="width:auto; font-size:0.8rem;"><i class="fas fa-download"></i> File Tugas: ${a.file.name}</a></div>` : '';

            let html = `
                <div class="card mb-3 p-4">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h4 style="margin:0; color:var(--grad-amber);">${a.title}</h4>
                            <small class="text-dim">Dibuat: ${new Date(a.date).toLocaleString('id-ID')}</small>
                            <div class="mt-1"><span class="badge ${isLate ? 'badge-danger' : 'badge-primary'}">Deadline: ${deadlineDate.toLocaleString('id-ID')}</span></div>
                        </div>
                        ${isTeacher ? `<button class="btn btn-danger" style="width:auto; padding:0.4rem 0.8rem;" onclick="window.app.deleteAssignment('${a.id}')"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                    <p class="mt-3" style="font-size:0.9rem;">${a.desc}</p>
                    ${fileHtml}
                    <hr class="mt-3 mb-3">
            `;

            if (isTeacher) {
                html += `
                    <div class="mt-2">
                        <strong>Pengumpulan: ${submissionsCount} Siswa</strong>
                        <button class="btn btn-secondary mt-2" onclick="window.app.viewSubmissions('${a.id}')"><i class="fas fa-eye"></i> Lihat Pengumpulan</button>
                    </div>
                `;
            } else if (this.state.currentRole === 'siswa') {
                if (submission) {
                    const submFileHtml = submission.file ? `<div class="mt-1"><a href="${submission.file.data}" download="${submission.file.name}" class="text-primary small"><i class="fas fa-paperclip"></i> ${submission.file.name}</a></div>` : '';
                    html += `
                        <div class="mt-2 p-3" style="background:#f0fdf4; border-radius:8px;">
                            <span class="status-hadir"><i class="fas fa-check-circle"></i> Sudah Dikumpulkan</span>
                            <div class="mt-1 small">Konten: ${submission.content}</div>
                            ${submFileHtml}
                            <div class="mt-1"><strong>Nilai: ${submission.grade || 'Belum Dinilai'}</strong></div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="mt-2">
                            <textarea id="sub-input-${a.id}" class="input-field" placeholder="Masukkan link tugas atau jawaban singkat di sini..."></textarea>
                            <div class="input-group">
                                <label class="small">Lampirkan File (Opsional)</label>
                                <input type="file" id="sub-file-${a.id}" class="input-field" accept=".jpg,.jpeg,.pdf,.doc,.docx">
                            </div>
                            <button class="btn btn-success" onclick="window.app.submitAssignment('${a.id}')"><i class="fas fa-paper-plane"></i> Kirim Tugas</button>
                        </div>
                    `;
                }
            }
            html += `</div>`;
            return html;
        }).join('') || '<p class="text-muted text-center">Belum ada tugas</p>';
    },

    submitAssignment(id) {
        const content = document.getElementById(`sub-input-${id}`).value.trim();
        const fileInput = document.getElementById(`sub-file-${id}`);
        if (!content && fileInput.files.length === 0) return alert("Jawaban atau file tidak boleh kosong!");
        
        const save = (fileData = null) => {
            this.state.submissions.push({
                id: 'subm-' + Date.now(), assignmentId: id, studentId: this.state.currentUser,
                content, file: fileData, date: new Date().toISOString(), grade: null
            });
            this.saveSubmissions(); alert("Tugas berhasil dikirim!"); this.renderAssignments();
        };

        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => save({ name: file.name, data: e.target.result, type: file.type });
            reader.readAsDataURL(file);
        } else save();
    },

    viewSubmissions(assignmentId) {
        const assignment = this.state.assignments.find(a => a.id === assignmentId);
        const list = this.state.submissions.filter(s => s.assignmentId === assignmentId);
        const sub = this.state.academic.subjects.find(s => s.id === this.state.currentHubId);
        
        // We'll reuse the manual-absen-overlay for submissions view
        const overlay = document.getElementById('manual-absen-overlay');
        overlay.style.display = 'flex';
        document.getElementById('manual-session-info').innerText = `Pengumpulan: ${assignment.title}`;
        const body = document.getElementById('manual-absen-body');
        
        body.innerHTML = list.map((s, i) => {
            const fileHtml = s.file ? `<br><a href="${s.file.data}" download="${s.file.name}" class="text-primary small"><i class="fas fa-download"></i> ${s.file.name}</a>` : '';
            return `
                <tr>
                    <td>${i+1}</td>
                    <td>${this.state.students[s.studentId]?.name || s.studentId}</td>
                    <td>${s.content}${fileHtml}</td>
                    <td>
                        <div style="display:flex; gap:0.5rem;">
                            <input type="number" class="input-field grade-input" data-sub-id="${s.id}" value="${s.grade || ''}" style="width:70px; margin:0;" placeholder="0-100">
                            <button class="btn btn-primary" style="width:auto; padding:0.4rem 0.8rem;" onclick="window.app.saveGrade('${s.id}')"><i class="fas fa-save"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="4" class="text-center text-muted">Belum ada siswa yang mengumpulkan</td></tr>';
        
        // Modify the "Simpan" button of manual-absen modal temporarily? No, let's just use separate logic for grading
        // For simplicity, let's change the Save button of manual modal to hide when viewing submissions? 
        // Better yet, I'll just change the text of the button.
        const saveBtn = document.querySelector('#manual-absen-overlay .btn-success');
        saveBtn.style.display = 'none'; // Individual save buttons are used
    },

    saveGrade(subId) {
        const gradeInput = document.querySelector(`.grade-input[data-sub-id="${subId}"]`);
        const grade = gradeInput.value;
        const sub = this.state.submissions.find(s => s.id === subId);
        if (sub) {
            sub.grade = grade;
            this.saveSubmissions();
            alert("Nilai berhasil disimpan!");
        }
    },

    renderHubRekap() {
        const related = this.getRelatedSubjects(this.state.currentHubId);
        if (related.length === 0) return;
        const sub = related[0];
        const relIds = related.map(s => s.id);
        const isTeacher = this.state.currentRole === 'teacher';
        
        document.getElementById('rekap-teacher-view').style.display = isTeacher ? 'block' : 'none';
        document.getElementById('rekap-student-view').style.display = !isTeacher ? 'block' : 'none';

        if (isTeacher) {
            const body = document.getElementById('hub-rekap-body');
            const students = Object.entries(this.state.students).filter(([,s]) => s.classId === sub.classId);
            const allRecs = this.state.history.filter(h => relIds.includes(h.subjectId));
            body.innerHTML = students.map(([nim, s]) => {
                const recs = allRecs.filter(r => r.nim === nim);
                const c = {hadir:0,terlambat:0,izin:0,sakit:0,alpa:0};
                recs.forEach(r => { if(c[r.status]!==undefined) c[r.status]++; });
                return `<tr>
                    <td>${s.name || '-'}</td>
                    <td>${nim}</td>
                    <td class="status-hadir text-center">${c.hadir}</td>
                    <td class="status-terlambat text-center">${c.terlambat}</td>
                    <td class="status-izin text-center">${c.izin}</td>
                    <td class="status-sakit text-center">${c.sakit}</td>
                    <td class="status-alpa text-center">${c.alpa}</td>
                </tr>`;
            }).join('') || '<tr><td colspan="7" class="text-center">Belum ada data siswa</td></tr>';
        } else {
            const nim = this.state.currentUser;
            const related = this.getRelatedSubjects(this.state.currentHubId);
            const relIds = related.map(s => s.id);
            const records = this.state.history.filter(h => relIds.includes(h.subjectId) && h.nim === nim);
            const counts = {hadir:0,terlambat:0,izin:0,sakit:0,alpa:0};
            records.forEach(r => { if(counts[r.status]!==undefined) counts[r.status]++; });
            
            const stats = document.getElementById('hub-student-rekap-stats');
            if(stats) stats.innerHTML = Object.entries(counts).map(([k,v])=>`<div class="rekap-stat-card"><div class="stat-number stat-${k}">${v}</div><div class="stat-label">${k}</div></div>`).join('');
            
            const body = document.getElementById('hub-student-rekap-body');
            body.innerHTML = records.map(r => {
                const cls = 'status-'+(r.status||'hadir');
                return `<tr><td>${r.displayTime||r.date||'-'}</td><td class="${cls}">${(r.status||'hadir').toUpperCase()}</td><td>${r.source==='qr'?'Scanner QR':'Input Manual'}</td></tr>`;
            }).join('') || '<tr><td colspan="3" class="text-center text-muted">Belum ada catatan kehadiran di mapel ini</td></tr>';
        }
    },

    downloadExcelRekap() {
        const sub = this.state.academic.subjects.find(s => s.id === this.state.currentHubId);
        if (!sub) return;
        const students = Object.entries(this.state.students).filter(([,s]) => s.classId === sub.classId);
        const allRecs = this.state.history.filter(h => h.subjectId === sub.id);
        
        const data = students.map(([nim, s]) => {
            const recs = allRecs.filter(r => r.nim === nim);
            const c = {hadir:0,terlambat:0,izin:0,sakit:0,alpa:0};
            recs.forEach(r => { if(c[r.status]!==undefined) c[r.status]++; });
            return {
                'NISN': nim,
                'Nama Siswa': s.name || nim,
                'Hadir': c.hadir,
                'Terlambat': c.terlambat,
                'Izin': c.izin,
                'Sakit': c.sakit,
                'Alpa': c.alpa,
                'Total Sesi': recs.length
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absensi");
        XLSX.writeFile(workbook, `Rekap_Absensi_${sub.name}_${sub.classId}.xlsx`);
    },

    closeFullscreenQR() { document.getElementById('fullscreen-qr-overlay').style.display = 'none'; },
    // === SCANNER ===
    stopAllScanners() {
        if (this.state.scanner) { this.state.scanner.stop().catch(()=>{}); this.state.scanner = null; }
    },
    startStudentScanner() {
        document.getElementById('siswa-scan-area').style.display = 'block';
        this.state.scanner = new Html5Qrcode('siswa-reader');
        this.state.scanner.start({facingMode:'environment'},{fps:10,qrbox:250},(decoded)=>{
            const ses = this.state.sessions.find(s => s.id === decoded);
            if (!ses) { alert('QR tidak valid!'); return; }
            const sub = this.state.academic.subjects.find(s => s.id === ses.subjectId);
            const nim = this.state.currentUser;
            const exists = this.state.history.find(h => h.sessionId === ses.id && h.nim === nim);
            if (exists) { alert('Anda sudah absen pada sesi ini!'); this.stopStudentScanner(); return; }
            this.state.history.push({sessionId:ses.id,subjectId:ses.subjectId,nim,status:'hadir',source:'qr',date:ses.date,displayTime:ses.displayDate,subjectName:sub?sub.name:'',time:new Date().toISOString()});
            this.saveHistory();
            alert(`Absensi Berhasil! ${sub?sub.name:''} - ${ses.displayDate}`);
            this.stopStudentScanner(); this.renderSubjectGrid('siswa'); this.renderSiswaRekap();
        }).catch(err => alert('Gagal akses kamera: '+err));
    },
    stopStudentScanner() {
        this.stopAllScanners();
        document.getElementById('siswa-scan-area').style.display = 'none';
    },

    // === OPERATOR: TEACHER MANAGEMENT ===
    addTeacher() {
        const id = document.getElementById('opt-teacher-id').value.trim();
        const pwd = document.getElementById('opt-teacher-pwd').value.trim();
        if (!id || !pwd) return alert("Username dan Password wajib diisi!");
        if (this.state.teachers[id]) return alert("Guru dengan username tersebut sudah ada!");
        this.state.teachers[id] = { password: this.encrypt(pwd), isActive: true };
        this.saveTeachers();
        this.renderTeacherList();
        this.renderAcademicLists();
        document.getElementById('opt-teacher-id').value = '';
        document.getElementById('opt-teacher-pwd').value = '';
        alert(`Guru "${id}" berhasil ditambahkan!`);
    },

    deleteTeacher(id) {
        if (!confirm(`Hapus guru "${id}"?`)) return;
        delete this.state.teachers[id];
        this.saveTeachers();
        this.renderTeacherList();
        this.renderAcademicLists();
    },

    renderTeacherList() {
        const body = document.getElementById('teacher-list-body');
        if (!body) return;
        body.innerHTML = Object.keys(this.state.teachers).map(u => {
            const t = this.state.teachers[u];
            const photo = t.photo || 'https://via.placeholder.com/40?text=G';
            return `<tr>
                <td><img src="${photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"></td>
                <td>${u}</td>
                <td>${this.decrypt(t.password)}</td>
                <td><span class="badge ${t.isActive ? 'badge-success' : 'badge-danger'}">${t.isActive ? 'Aktif' : 'Nonaktif'}</span></td>
                <td><button class="btn btn-danger" style="width:auto;padding:0.5rem 1rem;font-size:0.8rem;" onclick="window.app.deleteTeacher('${u}')"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }).join('') || '<tr><td colspan="5" class="text-center text-muted">Belum ada guru</td></tr>';
    },

    // === OPERATOR: STUDENT MANAGEMENT ===
    addStudent() {
        const name = document.getElementById('opt-new-siswa-name').value.trim();
        const nim = document.getElementById('opt-new-siswa-nim').value.trim();
        const pwd = document.getElementById('opt-new-siswa-pwd').value.trim();
        const classId = document.getElementById('opt-new-siswa-class').value;
        if (!name || !nim || !pwd) return alert("Nama, NISN dan Password wajib diisi!");
        if (this.state.students[nim]) return alert("Siswa dengan NISN tersebut sudah ada!");
        this.state.students[nim] = { name: name, password: this.encrypt(pwd), classId: classId };
        this.saveStudents();
        this.renderStudentAccountList();
        document.getElementById('opt-new-siswa-name').value = '';
        document.getElementById('opt-new-siswa-nim').value = '';
        document.getElementById('opt-new-siswa-pwd').value = '';
        alert(`Siswa "${name}" berhasil ditambahkan!`);
    },

    deleteStudent(nim) {
        if (!confirm(`Hapus siswa "${nim}"?`)) return;
        delete this.state.students[nim];
        this.saveStudents();
        this.renderStudentAccountList();
    },

    renderStudentAccountList() {
        const body = document.getElementById('student-list-body');
        if (!body) return;
        body.innerHTML = Object.entries(this.state.students).map(([nim, s]) => {
            const photo = s.photo || 'https://via.placeholder.com/40?text=S';
            return `<tr>
                <td><img src="${photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"></td>
                <td>${s.name || '-'}</td>
                <td>${nim}<br><small class="text-muted">Sandi: ${this.decrypt(s.password)}</small></td>
                <td>${s.classId || '-'}</td>
                <td><button class="btn btn-danger" style="width:auto;padding:0.5rem 1rem;font-size:0.8rem;" onclick="window.app.deleteStudent('${nim}')"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }).join('') || '<tr><td colspan="5" class="text-center text-muted">Belum ada siswa</td></tr>';

        // Update class dropdown for student creation
        const classSelect = document.getElementById('opt-new-siswa-class');
        if (classSelect) {
            classSelect.innerHTML = '<option value="">Pilih Kelas</option>' +
                this.state.academic.classes.map(c => `<option value="${c}">${c}</option>`).join('');
        }
    },

    // === OPERATOR: ACADEMIC MANAGEMENT ===
    addSemester() {
        const name = document.getElementById('opt-new-semester').value.trim();
        if (!name) return;
        if (this.state.academic.semesters.includes(name)) return alert("Semester sudah ada!");
        this.state.academic.semesters.push(name);
        this.saveAcademic(); this.renderAcademicLists();
        document.getElementById('opt-new-semester').value = '';
    },

    deleteSemester(name) {
        this.state.academic.semesters = this.state.academic.semesters.filter(s => s !== name);
        this.saveAcademic(); this.renderAcademicLists();
    },

    addClass() {
        const name = document.getElementById('opt-new-class').value.trim();
        if (!name) return;
        if (this.state.academic.classes.includes(name)) return alert("Kelas sudah ada!");
        this.state.academic.classes.push(name);
        this.saveAcademic(); this.renderAcademicLists();
        document.getElementById('opt-new-class').value = '';
    },

    deleteClass(name) {
        this.state.academic.classes = this.state.academic.classes.filter(c => c !== name);
        this.saveAcademic(); this.renderAcademicLists();
    },

    addMasterSubject() {
        const name = document.getElementById('opt-new-master-subject').value.trim();
        if (!name) return;
        if (this.state.academic.masterSubjects.includes(name)) return alert("Mata pelajaran sudah ada!");
        this.state.academic.masterSubjects.push(name);
        this.saveAcademic(); this.renderAcademicLists();
        document.getElementById('opt-new-master-subject').value = '';
    },

    deleteMasterSubject(name) {
        this.state.academic.masterSubjects = this.state.academic.masterSubjects.filter(m => m !== name);
        this.saveAcademic(); this.renderAcademicLists();
    },

    addSubjectByOperator() {
        const name = document.getElementById('opt-subject-master-select').value;
        const semesterId = document.getElementById('opt-subject-semester').value;
        const classId = document.getElementById('opt-subject-class');
        const teacherCheckboxes = document.querySelectorAll('#opt-teacher-checkbox-list input:checked');
        const teacherIds = Array.from(teacherCheckboxes).map(cb => cb.value);
        
        const id = `${name}-${classVal}-${semesterId}-${Date.now()}`;
        
        // Check if exists to merge
        const existing = this.state.academic.subjects.find(s => s.name === name && s.classId === classVal && s.semesterId === semesterId);
        if (existing) {
            if (!existing.teacherIds) existing.teacherIds = [existing.teacherId];
            teacherIds.forEach(tid => {
                if (!existing.teacherIds.includes(tid)) existing.teacherIds.push(tid);
            });
            alert(`Mata Pelajaran "${name}" sudah ada. Guru baru telah ditambahkan ke dalamnya!`);
        } else {
            this.state.academic.subjects.push({ id, name, semesterId, classId: classVal, teacherIds });
            alert(`Mata Pelajaran "${name}" berhasil ditugaskan ke: ${teacherIds.join(', ')}!`);
        }
        
        this.saveAcademic(); this.renderAcademicLists();
    },

    deleteSubject(id) {
        if (!confirm("Hapus penugasan mata pelajaran ini?")) return;
        this.state.academic.subjects = this.state.academic.subjects.filter(s => s.id !== id);
        // Also remove related attendance history
        this.state.history = this.state.history.filter(h => h.subjectId !== id);
        this.saveAcademic(); this.saveHistory(); this.renderAcademicLists();
    },

    renderAcademicLists() {
        // Semesters
        const semList = document.getElementById('semester-list');
        if (semList) {
            semList.innerHTML = this.state.academic.semesters.map(s =>
                `<span class="badge badge-primary" style="margin:0.25rem;cursor:pointer;" onclick="window.app.deleteSemester('${s}')">${s} <i class="fas fa-times" style="margin-left:0.3rem;"></i></span>`
            ).join('') || '<span class="text-muted">Belum ada semester</span>';
        }
        // Classes
        const clsList = document.getElementById('class-list');
        if (clsList) {
            clsList.innerHTML = this.state.academic.classes.map(c =>
                `<span class="badge badge-primary" style="margin:0.25rem;cursor:pointer;" onclick="window.app.deleteClass('${c}')">${c} <i class="fas fa-times" style="margin-left:0.3rem;"></i></span>`
            ).join('') || '<span class="text-muted">Belum ada kelas</span>';
        }
        // Master Subjects
        const msList = document.getElementById('master-subject-list');
        if (msList) {
            msList.innerHTML = this.state.academic.masterSubjects.map(m =>
                `<span class="badge badge-primary" style="margin:0.25rem;cursor:pointer;" onclick="window.app.deleteMasterSubject('${m}')">${m} <i class="fas fa-times" style="margin-left:0.3rem;"></i></span>`
            ).join('') || '<span class="text-muted">Belum ada master mapel</span>';
        }
        // Dropdowns
        const selSubject = document.getElementById('opt-subject-master-select');
        if (selSubject) {
            selSubject.innerHTML = '<option value="">-- Pilih Mapel --</option>' +
                this.state.academic.masterSubjects.map(m => `<option value="${m}">${m}</option>`).join('');
        }
        const selSem = document.getElementById('opt-subject-semester');
        if (selSem) {
            selSem.innerHTML = '<option value="">-- Pilih Semester --</option>' +
                this.state.academic.semesters.map(s => `<option value="${s}">${s}</option>`).join('');
        }
        const selClass = document.getElementById('opt-subject-class');
        if (selClass) {
            selClass.innerHTML = '<option value="">-- Pilih Kelas --</option>' +
                this.state.academic.classes.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        const teacherList = document.getElementById('opt-teacher-checkbox-list');
        if (teacherList) {
            teacherList.innerHTML = Object.keys(this.state.teachers).map(t => 
                `<label class="checkbox-item"><input type="checkbox" value="${t}"> ${t}</label>`
            ).join('') || '<span class="text-muted">Belum ada guru</span>';
        }
        // Subject assignment table
        const subBody = document.getElementById('subject-assignment-body');
        if (subBody) {
            subBody.innerHTML = this.state.academic.subjects.map(sub => {
                const teacherDisplay = sub.teacherIds ? sub.teacherIds.join(', ') : sub.teacherId;
                return `<tr><td>${sub.name}</td><td>${sub.classId}</td><td>${sub.semesterId}</td><td>${teacherDisplay}</td>
                <td><button class="btn btn-danger" style="width:auto;padding:0.5rem 1rem;font-size:0.8rem;" onclick="window.app.deleteSubject('${sub.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
            }).join('') || '<tr><td colspan="5" class="text-center text-muted">Belum ada penugasan</td></tr>';
        }
        // Update student class dropdown
        const classSelect = document.getElementById('opt-new-siswa-class');
        if (classSelect) {
            classSelect.innerHTML = '<option value="">Pilih Kelas</option>' +
                this.state.academic.classes.map(c => `<option value="${c}">${c}</option>`).join('');
        }
    },

    // === BACKUP & RESTORE ===
    backupData() {
        const keys = [
            'absensi_school_config', 'absensi_teachers_data', 'absensi_students_accounts',
            'absensi_academic_data', 'absensi_materials', 'absensi_assignments',
            'absensi_submissions', 'absensi_history', 'absensi_sessions'
        ];
        const data = {};
        keys.forEach(key => {
            const val = localStorage.getItem(key);
            if (val) data[key] = JSON.parse(val);
        });

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_absensi_sekolah_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast("Data berhasil dicadangkan! Silakan kirim file ini ke HP Anda.", "success");
    },

    restoreData(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!confirm("Peringatan: Memulihkan data akan menghapus data yang ada saat ini di perangkat ini. Lanjutkan?")) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                Object.keys(data).forEach(key => {
                    localStorage.setItem(key, JSON.stringify(data[key]));
                });
                this.showToast("Data berhasil dipulihkan! Halaman akan dimuat ulang...", "success");
                setTimeout(() => location.reload(), 2000);
            } catch (err) {
                alert("Gagal memulihkan data: File tidak valid.");
            }
        };
        reader.readAsText(file);
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle');
        toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    },

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .then(() => console.log('Service Worker Registered'))
                .catch(err => console.error('SW Registration Failed:', err));
        }
    }
};

window.addEventListener('DOMContentLoaded', () => { window.app.init(); });
