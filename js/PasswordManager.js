(function() {

  const DEBUG = true;

  function log() {
    if (DEBUG) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('pwdmgr:');
      console.log.apply(console, args);
    }
  }

  function PasswordManager() {
    log('Starting real passwordManager');
    this.currentApp = null;
    window.addEventListener('appopened', this);
  }

  PasswordManager.prototype.handleEvent = function (evt) {
    log('Handling event: ' + evt.type);
    switch (evt.type) {

    case 'appopened':
      if (this.currentApp && this.currentApp.element) {
        this.currentApp.element.removeEventListener('mozbrowsermetachange', this);
        this.currentApp.element.removeEventListener('mozbrowserloadend', this);
      }
      this.currentApp = evt.detail;
      this.currentApp.element.addEventListener('mozbrowsermetachange', this);
      this.currentApp.element.addEventListener('mozbrowserloadend', this);
      break;

    case 'mozbrowserloadend':
      this.pageLoaded();
      break;

    case 'mozbrowsermetachange':
      try {
        var content = JSON.parse(evt.detail.content);
        if (content && content.type && content.type === 'submit') {
          this.newPassword(content);
        }
      } catch (e) { }
      break;
    };
  };

  PasswordManager.prototype.pageLoaded = function () {

    var url = this.currentApp.config.url;
    var data = localStorage.getItem(url);

    if (data) {

      log('Sending password data', data, 'to', url);

      // Sending the JSON as a string because ¯\_(ツ)_/¯
      // (sending actual json didnt seem to work)
      var script = 'window.dispatchEvent(new CustomEvent("loginFound", ' +
        '{"detail": \'' + data + '\'}));';
      this.currentApp.browser.element.executeScript(script, {url: url});
    }
  }

  PasswordManager.prototype.newPassword = function (detail) {
    log('Got a new password');
    var isUpdate = detail.url in localStorage;
    var text = isUpdate ? 'update-password' : 'save-password';

    // window.ModalDialog.showWithPseudoEvent({
    //   type: 'confirm',
    //   callback: function() {
    //     log('lets do this');
    //   }
    // });

    // The above should be confirming whether the user wants to
    // save / update the password, not currently working
    localStorage[detail.url] = JSON.stringify(detail);
  };

  // Is document already loaded?
  if (document.documentElement) {
    passwordManager = new PasswordManager();
  } else {
    window.addEventListener('DOMContentLoaded', function() {
      if (document.documentElement.dataset.pwdMgrStarted) {
        log('Password manager has already started, bailing');
        return;
      }
      document.documentElement.dataset.pwdMgrStarted = true;
      passwordManager = new PasswordManager();
    });
  }


})();
