(function() {

  var contentManager;
  const DEBUG = true;

  function wrap(fun) {
    return function() {
      try {
        return fun.apply(this, arguments);
      } catch (err) {
        log(err);
      }
    }
  }

  function log() {
    if (DEBUG) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('pwdmgr:');
      console.log.apply(console, args);
    }
  }

  function ContentManager() {
    log('Starting content manager');

    // Listens to form submissions and catches the details that
    // are submitted
    window.addEventListener('submit', wrap(this.onFormSubmit.bind(this)));

    // This is triggered by the system app once a page is loaded and
    // login details are found for that page
    window.addEventListener('loginFound', wrap(this.loginFound.bind(this)));
  }


  // We have received login details for the currently loaded page
  // Fill in the form with those details
  ContentManager.prototype.loginFound = function(e) {
    log('Received new login');

    var data = JSON.parse(e.detail);

    // Currently just pick the first form on the page, will
    // want to relate it to the form the details were submitted with
    var form = document.querySelector('form');
    var fields = this.getFormFields(form, false);

    // TODO: Check for autocomplete attributes, length etc
    if (data.username && fields.username) {
      fields.username.value = data.username;
    }

    if (data.password && fields.newpass) {
      fields.newpass.value = data.password;
    }
  }

  // When a form is submitted, check if there are any passwords and
  // if there are, send them to be saved
  ContentManager.prototype.onFormSubmit = function(e) {
    var form = e.target;
    var fields = this.getFormFields(form, true);

    // No new password, nothing to do
    if (!fields || !fields.newpass) {
      return;
    }

    this.send({
      type: 'submit',
      url: document.location.href,
      hostname: document.location.host,
      username: fields.username.value,
      password: fields.newpass.value
    });
  };

  // TODO: GET RID OF THIS WITH FIRE
  // We send messages to the system app currently by putting the json
  // in a <meta name="theme-color" tag and listening for the
  // metachanged event in the system app
  ContentManager.prototype.send = function(json) {
    log('sending', JSON.stringify(json));
    var meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color'); // lol
    meta.setAttribute('content', JSON.stringify(json));
    document.getElementsByTagName('head')[0].appendChild(meta);
  };

  ContentManager.prototype.getFormFields = function(form, isSubmission) {

    var usernameField = null;

    // Locate the password field(s) in the form. Up to 3 supported.
    // If there's no password field, there's nothing for us to do.
    var pwFields = this.getPasswordFields(form, isSubmission);
    if (!pwFields)
      return false;

    // Locate the username field in the form by searching backwards
    // from the first passwordfield, assume the first text field is the
    // username. We might not find a username field if the user is
    // already logged in to the site.
    for (var i = pwFields[0].index - 1; i >= 0; i--) {
      var element = form.elements[i];
      if (this.isUsernameFieldType(element)) {
        usernameField = element;
        break;
      }
    }

    if (!usernameField) {
      log("(form -- no username field found)");
    }

    // If we're not submitting a form (it's a page load), there are no
    // password field values for us to use for identifying fields. So,
    // just assume the first password field is the one to be filled in.
    if (!isSubmission || pwFields.length == 1) {
      return {
        username: usernameField,
        newpass: pwFields[0].element
      };
    }

    // Try to figure out WTF is in the form based on the password values.
    var oldPasswordField, newPasswordField;
    var pw1 = pwFields[0].element.value;
    var pw2 = pwFields[1].element.value;
    var pw3 = (pwFields[2] ? pwFields[2].element.value : null);

    if (pwFields.length == 3) {
      // Look for two identical passwords, that's the new password

      if (pw1 == pw2 && pw2 == pw3) {
        // All 3 passwords the same? Weird! Treat as if 1 pw field.
        newPasswordField = pwFields[0].element;
        oldPasswordField = null;
      } else if (pw1 == pw2) {
        newPasswordField = pwFields[0].element;
        oldPasswordField = pwFields[2].element;
      } else if (pw2 == pw3) {
        oldPasswordField = pwFields[0].element;
        newPasswordField = pwFields[2].element;
      } else  if (pw1 == pw3) {
        // A bit odd, but could make sense with the right page layout.
        newPasswordField = pwFields[0].element;
        oldPasswordField = pwFields[1].element;
      } else {
        // We can't tell which of the 3 passwords should be saved.
        log("(form ignored -- all 3 pw fields differ)");
        return [null, null, null];
      }
    } else { // pwFields.length == 2
      if (pw1 == pw2) {
        // Treat as if 1 pw field
        newPasswordField = pwFields[0].element;
        oldPasswordField = null;
      } else {
        // Just assume that the 2nd password is the new password
        oldPasswordField = pwFields[0].element;
        newPasswordField = pwFields[1].element;
      }
    }

    return {
      username: usernameField,
      newpass: newPasswordField,
      oldpass: oldPasswordField
    };
  };

  ContentManager.prototype.getPasswordFields = function(form, skipEmptyFields) {
    // Locate the password fields in the form.
    var pwFields = [];
    for (var i = 0; i < form.elements.length; i++) {
      var element = form.elements[i];
      if (!(element instanceof HTMLInputElement) ||
          element.type != "password")
        continue;

      if (skipEmptyFields && !element.value)
        continue;

      pwFields[pwFields.length] = { index   : i,
                                    element : element };
    }

    // If too few or too many fields, bail out.
    if (pwFields.length == 0) {
      log("(form ignored -- no password fields.)");
      return null;
    } else if (pwFields.length > 3) {
      log("(form ignored -- too many password fields. [ got ",
                  pwFields.length, "])");
      return null;
    }
    return pwFields;
  };

  ContentManager.prototype.isUsernameFieldType = function(element) {
    if (!(element instanceof HTMLInputElement))
      return false;

    var fieldType = (element.hasAttribute("type") ?
                     element.getAttribute("type").toLowerCase() :
                     element.type);
    if (fieldType == "text"  ||
        fieldType == "email" ||
        fieldType == "url"   ||
        fieldType == "tel"   ||
        fieldType == "number") {
      return true;
    }
    return false;
  };


  if (document.location.href === 'app://system.gaiamobile.org/index.html') {
    log('Not loading the content manager in the system app');
    return;
  }

  // Is document already loaded?
  if (document.documentElement) {
    contentManager = new ContentManager();
  } else {
    window.addEventListener('DOMContentLoaded', function() {
      if (document.documentElement.dataset.pwdMgrStarted) {
        log('Password manager has already started, bailing');
        return;
      }
      document.documentElement.dataset.pwdMgrStarted = true;
      contentManager = new ContentManager();
    });
  }

})();
