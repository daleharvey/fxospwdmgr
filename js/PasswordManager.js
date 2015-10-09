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
    log('Starting PasswordManager');
    chrome.runtime.onMessage.addListener(this.handleMsg.bind(this));
  }

  PasswordManager.prototype.handleMsg = function (request, sender, respond) {
    log('Handling event: ', request.type);
    log('data: ', JSON.stringify(request));
    switch (request.type) {

    case 'pageloaded':
      this.pageLoaded(request, sender, respond);
      return true;
      break;

    case 'passwordsubmitted':
      this.newPassword(request);
      break;
    };
  };

  PasswordManager.prototype.pageLoaded = function (request, sender, respond) {

    chrome.storage.local.get(request.url, function(result) {
      var data = request.url in result ? result[request.url] : false;
      if (data) {
        log('Sending password data', data, 'to', request.url);
        respond(data);
      } else {
        log('No details found');
        respond(false);
      }
    });
  }

  PasswordManager.prototype.newPassword = function (detail) {
    log('Got a new password');

    // This is where we should show some UI about whether to
    // store / update
    // var isUpdate = detail.url in localStorage;
    // var text = isUpdate ? 'update-password' : 'save-password';
    // window.ModalDialog.showWithPseudoEvent({
    //   type: 'confirm',
    //   callback: function() {
    //     log('lets do this');
    //   }
    // });

    var toSave = {};
    toSave[detail.url] = detail;
    chrome.storage.local.set(toSave, function() {
      log('Saved new password');
    });
  };

  if (document.documentElement.dataset.pwdMgrStarted) {
    log('Password manager has already started, bailing');
    return;
  }
  document.documentElement.dataset.pwdMgrStarted = true;
  passwordManager = new PasswordManager();

})();
