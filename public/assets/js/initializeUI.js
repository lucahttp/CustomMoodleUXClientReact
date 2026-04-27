/*
;(async () => {
  const app = document.createElement('div')
  app.id = 'root'
  document.body.append(app)



  
  const simpleText = document.createElement('p')
  simpleText.textContent = 'de naziiiii'
  document.body.append(simpleText)


  const src = chrome?.runtime?.getURL('/react/index.js')
  await import(src)
})()
*/

// This script injects a button into the page that, when clicked, will remove all existing content from the body and inject a new React component.

// Intercept console warnings/errors to silence annoying Moodle native warnings about color inputs
const silenceColorWarnings = (originalFn) => function(...args) {
  if (typeof args[0] === 'string' && args[0].includes('#rrggbb')) return;
  originalFn.apply(console, args);
};
console.warn = silenceColorWarnings(console.warn);
console.error = silenceColorWarnings(console.error);

// Proactively fix inputs that trigger these warnings
const fixColorInputs = () => {
  document.querySelectorAll('input[type="color"]').forEach(input => {
    if (!input.value || input.value === "") {
      input.value = "#000000";
    }
  });
};
fixColorInputs();
setInterval(fixColorInputs, 2000); // Keep fixing them if Moodle re-renders

(() => {
  if (sessionStorage.getItem('mux-bypass') === 'true') {
    // Provide a way to turn it back on from the classic UI
    const enableUxBtn = document.createElement("button");
    enableUxBtn.textContent = "Activar Moodle UX";
    enableUxBtn.style = "position: fixed; bottom: 20px; left: 20px; z-index: 99999; padding: 10px 20px; background: #4f46e5; color: white; border-radius: 20px; border: none; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: sans-serif;";
    enableUxBtn.onclick = () => {
      sessionStorage.removeItem('mux-bypass');
      window.location.reload();
    };
    if (document.body) {
      document.body.appendChild(enableUxBtn);
    } else {
      window.addEventListener('DOMContentLoaded', () => document.body.appendChild(enableUxBtn));
    }
    return; // Stop execution of the UX injection
  }

  // Create a button to trigger the injection
  var sessionObject = {};

  // Inject spinner styles and sleek button styles
  const styleStr = document.createElement("style");
  styleStr.textContent = `
    @keyframes mux-spin {
      100% { transform: rotate(360deg); }
    }
    .mux-btn {
      position: fixed;
      bottom: 30px;
      right: 30px;
      z-index: 10000;
      padding: 12px 24px;
      background-color: #6c757d;
      color: #ffffff;
      border: none;
      border-radius: 50px;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: not-allowed;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: 0.9;
    }
    .mux-btn.mux-btn-ready {
      background-color: #4f46e5;
      cursor: pointer;
      box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
      opacity: 1;
    }
    .mux-btn.mux-btn-ready:hover {
      background-color: #4338ca;
      transform: translateY(-2px);
    }
  `;
  const injectButton = document.createElement("button");
  injectButton.className = "mux-btn";
  injectButton.disabled = true;
  injectButton.innerHTML = `
    <svg viewBox="0 0 50 50" style="width: 20px; height: 20px; animation: mux-spin 1s linear infinite;">
      <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-dasharray="90, 150" style="stroke-dashoffset: 0;"></circle>
    </svg>
    <span>Loading Moodle UX...</span>
  `;

  const injectStylesAndButton = () => {
    if (document.head && document.body) {
      document.head.appendChild(styleStr);
      document.body.prepend(injectButton);
    } else {
      setTimeout(injectStylesAndButton, 50);
    }
  };
  injectStylesAndButton();

  const codeToInject = async () => {
    document.body.innerHTML = ""; // Remove all existing body content
    console.log("Injecting ReactJS code... and the sessionKey is: ", sessionObject.sesskey);
    const app = document.createElement("div");
    app.id = "root";
    document.body.append(app);

    //const simpleText = document.createElement('p');
    //simpleText.textContent = 'de naziiiii';
    //document.body.append(simpleText);


    //remove all scripts
    const scripts = document.querySelectorAll("script");
    scripts.forEach((script) => script.remove());

    //remove all styles
    const styles = document.querySelectorAll("style");
    styles.forEach((style) => style.remove());

    //remove all links
    const links = document.querySelectorAll("link");
    links.forEach((link) => link.remove());




    //<script src="http://localhost:8097"></script>
    //const script = document.createElement("script");
    //script.src = "http://localhost:8097";
    //document.head.appendChild(script);


    //const src = chrome?.runtime?.getURL ? chrome.runtime.getURL('/react/index.js') : '/react/index.js';
    const reactCssLink = document.createElement("link");
    reactCssLink.type = "text/css";
    reactCssLink.rel = "stylesheet";
    reactCssLink.href = chrome.runtime.getURL("/react/index.css");
    document.head.appendChild(reactCssLink);



    /*
    const srcReactDevTools = "http://localhost:8097";
    try {
      await import(srcReactDevTools);
    } catch (error) {
      console.error("Error importing ReactDevTools script:", error);
    }
      */



    const src = chrome?.runtime?.getURL("/react/index.js");
    try {
      await import(src);
    } catch (error) {
      console.error("Error importing script:", error);
    }
  };
  injectButton.addEventListener("click", codeToInject);


  window.addEventListener("getSessionObject", function () {
    console.log("getSessionObject event received");
    const event = new CustomEvent("variableValueRetrieved2", {
      detail: sessionObject,
    });
    window.dispatchEvent(event);
    console.log("Event dispatched with sessionObject:", sessionObject);
  });



  window.addEventListener("load", function load(event) {
    window.removeEventListener("load", load, false);
    console.log("content-script.js loaded");

    // Escuchamos cuando se reciba la sesión
    window.addEventListener("variableValueRetrieved", function (e) {
      sessionObject = e.detail;
      console.log("sessionObject:", sessionObject);

      // Update button state visually to show it's ready
      if (injectButton) {
        injectButton.disabled = false;
        injectButton.classList.add("mux-btn-ready");
        injectButton.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
            <path d="M5 12l5 5L20 7"></path>
          </svg>
          <span>Launch Moodle UX</span>
        `;
      }

      // Automatically run code injection right after a small delay
      // so the user can actually see the button change state before the screen is wiped.
      /*setTimeout(() => {
        codeToInject();
      }, 1500);*/
    });

    // Inyectamos el script para obtener el sessionKey desde el contexto de la página
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("/assets/js/inject-sesskey.js");
    script.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
    console.log("Javascript already injected");

  });
})();
