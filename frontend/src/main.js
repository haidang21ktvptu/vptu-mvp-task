// Điểm vào của app (GĐ4): nối các module lại, không chứa nghiệp vụ.
import './styles/main.css';
import { $ } from './lib/dom.js';
import { initActionDelegation } from './lib/actions.js';
import { initLogin, startSession } from './auth/login.js';
import { initChangePassword } from './auth/change-password.js';
import { restoreSession, handleLogout } from './auth/session.js';
import { registerViews } from './views/index.js';

initActionDelegation();
registerViews();
initLogin();
initChangePassword();
$('logoutBtn').addEventListener('click', handleLogout);
restoreSession(startSession);
