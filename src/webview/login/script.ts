import {
  provideVSCodeDesignSystem,
  allComponents,
  TextField,
  Checkbox,
  Button,
  Dropdown
} from '@vscode/webview-ui-toolkit';
import * as login from '../../message/login';
import { Messenger } from 'vscode-messenger-webview';

/** 注册`vscode-ui`的`webview`组件 */
provideVSCodeDesignSystem().register(allComponents);
/** 与扩展主体通信的变量 */
const vscode = acquireVsCodeApi();
/** 消息处理器 */
const messenger = new Messenger(vscode);
messenger.start();

// 获取页面组件
/** 登录状态选单 */
const statusDropdown = document.getElementById('online-status') as Dropdown;
/** 账号输入框 */
const uinText = document.getElementById('uin') as TextField;
/** 密码输入框 */
const passwordText = document.getElementById('password') as TextField;
/** 记住密码选项 */
const savePassCheckbox = document.getElementById('save-pass') as Checkbox;
/** 自动登录选项 */
const autoLoginCheckbox = document.getElementById('auto-login') as Checkbox;
/** 登录按钮 */
const loginButton = document.getElementById('login') as Button;

/** 登录超时计时器 */
let loginTimeout: NodeJS.Timeout | undefined;

/**
 * 刷新登录按钮状态
 */
function refreshButtonState() {
  /** 当账号有值时允许登录 */
  const state = uinText.value.length;
  loginButton.disabled = !state;
  if (state) {
    loginButton.textContent = '登录';
  }
}

/**
 * 切换登录状态，登录时禁用组件设置为只读
 * @param state 登录状态，默认为当前状态的下一状态
 */
function changeLoginState(state = !loginButton.disabled) {
  loginButton.disabled =
    uinText.readOnly =
    passwordText.readOnly =
    autoLoginCheckbox.readOnly =
    savePassCheckbox.readOnly =
    statusDropdown.disabled =
      state;
  if (state) {
    // 10s未登录成功则发送超时通知
    loginTimeout = setTimeout(() => {
      messenger.sendNotification(login.loginTimeout, { type: 'extension' });
    }, 10e3);
  } else {
    clearTimeout(loginTimeout);
  }
}

// 登录结果
messenger.onNotification(login.loginRet, (ret: boolean) => {
  if (!ret) {
    // 登录失败
    changeLoginState();
    refreshButtonState();
  }
});

// 提交登录信息
loginButton.addEventListener('click', () => {
  /** 登录信息 */
  const record: login.LoginInfo = {
    uin: Number(uinText.value),
    password: passwordText.value,
    savePass: savePassCheckbox.checked,
    autoLogin: autoLoginCheckbox.checked,
    onlineStatus: Number(statusDropdown.selectedOptions[0].value)
  };
  messenger.sendRequest(login.submitLoginInfo, { type: 'extension' }, record);
  changeLoginState();
  loginButton.textContent = '登录中';
});

// 动态判断登录按钮的状态
uinText.addEventListener('input', refreshButtonState);

// 响应回车键
window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    loginButton.click();
  }
});

(() => {
  refreshButtonState();
  // 获取登录账号历史信息
  messenger
    .sendRequest(login.getLoginInfo, { type: 'extension' })
    .then((loginInfo) => {
      if (!loginInfo) {
        return;
      }
      uinText.value = loginInfo.uin.toString();
      refreshButtonState();
      if (loginInfo.savePass) {
        passwordText.value = loginInfo.password;
      }
      savePassCheckbox.checked = loginInfo.savePass;
      autoLoginCheckbox.checked = loginInfo.autoLogin;
      for (const option of statusDropdown.options) {
        if (option.value === loginInfo.onlineStatus.toString()) {
          option.selected = true;
          return;
        }
      }
      if (autoLoginCheckbox.checked) {
        // 自动登录
        loginButton.click();
      }
    });
})();
