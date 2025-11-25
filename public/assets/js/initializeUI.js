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
  var sessionObject = {};
  const injectButton = document.createElement("button");
  injectButton.textContent = "Inject Code";
  injectButton.style.position = "fixed";
  injectButton.style.top = "20px";
  injectButton.style.left = "20px";
  injectButton.style.zIndex = "10000"; // Ensure it's on top
  document.body.prepend(injectButton);

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
