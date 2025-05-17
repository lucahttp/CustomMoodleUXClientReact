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
(() => {
  // Create a button to trigger the injection
  var sessionKey = "";
  const injectButton = document.createElement("button");
  injectButton.textContent = "Inject Code";
  injectButton.style.position = "fixed";
  injectButton.style.top = "20px";
  injectButton.style.left = "20px";
  injectButton.style.zIndex = "10000"; // Ensure it's on top
  document.body.prepend(injectButton);

  const codeToInject = async () => {
    document.body.innerHTML = ""; // Remove all existing body content
    console.log("Injecting ReactJS code... and the sessionKey is: ", sessionKey);
    const app = document.createElement("div");
    app.id = "root";
    document.body.append(app);

    //const simpleText = document.createElement('p');
    //simpleText.textContent = 'de naziiiii';
    //document.body.append(simpleText);

    //const src = chrome?.runtime?.getURL ? chrome.runtime.getURL('/react/index.js') : '/react/index.js';
    const reactCssLink = document.createElement("link");
    reactCssLink.type = "text/css";
    reactCssLink.rel = "stylesheet";
    reactCssLink.href = chrome.runtime.getURL("/react/index.css");
    document.head.appendChild(reactCssLink);

    const src = chrome?.runtime?.getURL("/react/index.js");
    try {
      await import(src);
    } catch (error) {
      console.error("Error importing script:", error);
    }
  };

  /*   // Escuchamos cuando se reciba la sesión
  window.addEventListener("variableValueRetrieved", function (e) {
    const sessionKey = e.detail;
    console.log("sesskey:", sessionKey);
    alert("sesskey: " + sessionKey);
  });

  function delayedFunction() {
    const srcToInject = chrome?.runtime?.getURL("/assets/js/inject-sesskey.js");
    try {
      import(srcToInject);
    } catch (error) {
      console.error("Error importing inject-sesskey.js:", error);
    }
  }

  setTimeout(delayedFunction, 1000); // Delay of 2000 milliseconds (2 seconds) */

  injectButton.addEventListener("click", codeToInject);



      // Escuchamos cuando se reciba la sesión
    window.addEventListener("getSessionKey", function () {
      console.log("getSessionKey event received");
      const event = new CustomEvent("variableValueRetrieved2", {
        detail: sessionKey,
      }); 
      window.dispatchEvent(event);
      console.log("Event dispatched with sessionKey:", sessionKey);
      //return sessionKey;
    });



  window.addEventListener("load", function load(event) {
    window.removeEventListener("load", load, false);
    console.log("content-script.js loaded");

    // Escuchamos cuando se reciba la sesión
    window.addEventListener("variableValueRetrieved", function (e) {
      sessionKey = e.detail;
      //const sessionKey = e.detail;
      console.log("sesskey:", sessionKey);

      //GetCourse(sessionKey, 22); // Cambia el 1 por el ID del curso que quieras obtener
      //GetCourses(sessionKey);
    });

    // Inyectamos el script para obtener el sessionKey desde el contexto de la página
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("/assets/js/inject-sesskey.js");
    script.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);

    //

    console.log("Javascript already injected");

  });
})();
