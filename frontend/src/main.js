// Điểm vào của app: nối các module lại, không chứa nghiệp vụ.
import './styles/main.css';
import { initActionDelegation } from './lib/actions.js';
import { initLogin, startSession } from './auth/login.js';
import { initChangePassword } from './auth/change-password.js';
import { restoreSession } from './auth/session.js';
import { registerViews } from './views/index.js';

initActionDelegation();
registerViews();
initLogin();
initChangePassword();
restoreSession(startSession);
