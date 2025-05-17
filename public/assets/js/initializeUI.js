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
  const injectButton = document.createElement('button');
  injectButton.textContent = 'Inject Code';
  injectButton.style.position = 'fixed';
  injectButton.style.top = '20px';
  injectButton.style.left = '20px';
  injectButton.style.zIndex = '10000'; // Ensure it's on top
  document.body.prepend(injectButton);

  const codeToInject = async () => {
    document.body.innerHTML = ''; // Remove all existing body content

    const app = document.createElement('div');
    app.id = 'root';
    document.body.append(app);

    //const simpleText = document.createElement('p');
    //simpleText.textContent = 'de naziiiii';
    //document.body.append(simpleText);

    //const src = chrome?.runtime?.getURL ? chrome.runtime.getURL('/react/index.js') : '/react/index.js';
    const reactCssLink = document.createElement('link');
    reactCssLink.type = 'text/css';
    reactCssLink.rel = 'stylesheet';
    reactCssLink.href = chrome.runtime.getURL('/react/index.css');
    document.head.appendChild(reactCssLink);



    const src = chrome?.runtime?.getURL('/react/index.js')
    try {
      await import(src);
    } catch (error) {
      console.error("Error importing script:", error);
    }
  };

  injectButton.addEventListener('click', codeToInject);
})();


