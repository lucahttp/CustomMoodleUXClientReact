// filepath: /google-slides-exporter/google-slides-exporter/src/background/index.js
document.addEventListener("DOMContentLoaded", function () {
  console.log("asdasd Google Slides Exporter background script loaded.");
});
async function downloadSVGWithEmbeddedImages(filename, svgElement) {
  const svgString = svgElement.outerHTML;
  const imageRegex = /xlink:href="([^"]+)"/g;
  let match;
  let updatedSvgString = svgString;

  while ((match = imageRegex.exec(svgString)) !== null) {
    const imageUrl = match[1];
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`Failed to fetch image: ${imageUrl}`);
        continue; // Skip this image if fetching fails
      }
      const blob = await response.blob();
      const reader = new FileReader();
      await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const base64DataUrl = reader.result;
          updatedSvgString = updatedSvgString.replace(imageUrl, base64DataUrl);
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(`Error processing image ${imageUrl}:`, error);
    }
  }

  // Create a download link with the updated SVG data
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(updatedSvgString)
  );
  element.setAttribute("download", filename + ".svg"); // Ensure .svg extension

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

async function downloadEmbeddedImages(svgElement) {
  const svgString = svgElement.outerHTML;
  const imageRegex = /xlink:href="([^"]+)"/g;
  let match;
  let updatedSvgString = svgString;

  while ((match = imageRegex.exec(svgString)) !== null) {
    const imageUrl = match[1];
    console.log("Image URL:", imageUrl); // Log the image URL for debugging
    // Check if the image URL is a data URL (base64) or a regular URL
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`Failed to fetch image: ${imageUrl}`);
        continue; // Skip this image if fetching fails
      }
      const blob = await response.blob();
      const reader = new FileReader();
      await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const base64DataUrl = reader.result;
          updatedSvgString = updatedSvgString.replace(imageUrl, base64DataUrl);
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(`Error processing image ${imageUrl}:`, error);
    }
  }

  //console.log("svg with images",updatedSvgString);
  let updatedSvgString2 = updatedSvgString.replace(
    /<g([^>]*)role="img"([^>]*)>(.*?)<\/g>/gs,
    (match, p1, p2, p3) => {
      return `<g${p1}role="text"${p2}>${p3}</g>`;
    }
  );
  //console.log("svg with text fixed",updatedSvgStriasng);

  return updatedSvgString2; // Return the updated SVG string with embedded images
}

var text = "hello";
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  switch (message.type) {
    case "getText":
      (async () => {
        // Try to find the SVG elements (assuming they are still <svg> tags)
        const msvg = document.getElementsByTagName("svg");
        console.log("SVG elements found:", msvg);
        if (!msvg.length) {
          console.error("No SVG elements found.");
          return;
        }

        let slideCount = null;
        let currentSlide = null;
        let allSVGHTML = "";
        let allSVGArray = [];
        // Function to try and get slide information
        const getSlideInfo = () => {
          // **This is a placeholder - you need to inspect the HTML to find the correct selectors**
          const sizeElement = document.querySelector("[data-slide-count]"); // Example using a data attribute
          const positionElement = document.querySelector(
            "[data-current-slide]"
          ); // Example using a data attribute

          if (sizeElement && positionElement) {
            slideCount = parseInt(
              sizeElement.getAttribute("data-slide-count"),
              10
            );
            currentSlide = parseInt(
              positionElement.getAttribute("data-current-slide"),
              10
            );
            return true;
          }

          // Try looking for ARIA attributes on different elements if data attributes aren't found
          const ariaSizeElement = document.querySelector("[aria-setsize]");
          const ariaPositionElement = document.querySelector("[aria-posinset]");

          if (ariaSizeElement && ariaPositionElement) {
            slideCount = parseInt(
              ariaSizeElement.getAttribute("aria-setsize"),
              10
            );
            currentSlide = parseInt(
              ariaPositionElement.getAttribute("aria-posinset"),
              10
            );
            return true;
          }

          return false;
        };

        // Function to try and trigger the next slide
        const triggerNextSlide = () => {
          // Another possibility: clicking on the main viewer container
          const viewerContainer = document.querySelector(
            ".sketchyViewerContainer"
          ).childNodes[0].childNodes[0]; //slide-viewer-container'); // Example class name

          if (viewerContainer) {
            // You might need to simulate a specific type of click or event
            viewerContainer.click();
            //setTimeout(() => window.print(), 1000);
            return true;
          }

          console.warn("Could not find element to trigger the next slide.");
          return false;
        };

        const processSlide = () => {
          allSVGHTML += msvg[0].outerHTML; // Append current SVG
          //sendResponse(msvg[0].outerHTML); // Send the updated SVG string back to the popup

          //allSVGArray.push(msvg[0].outerHTML);

          allSVGArray[currentSlide] = msvg[0].outerHTML; // Append current SVG to the array



          console.log(`Processing slide ${currentSlide} of ${slideCount}`);

          //downloadWithEmbeddedImages(`slide_N${currentSlide}_${slideCount}`, msvg[0]);

          if (getSlideInfo() && currentSlide === slideCount) {
            // Last slide reached
            //downloadEmbeddedImages(msvg[0]).then((updatedSVG) => {console.log("Updated SVG with embedded images:", updatedSVG);})

            console.log(allSVGArray);
            	/*
            chrome.tabs.query(
              { active: true, currentWindow: true },
              function (tabs) {
                chrome.tabs.sendMessage(
                  tabs[0].id,
                  { type: "sendArray", data: allSVGArray },
                  function (response) {
                    console.log("Response from content script:", response);
                  }
                );
              }
            );
            */
           /*
            chrome.tabs.sendMessage(
              tabs[0],
              { type: "sendArray", data: allSVGArray },
              function (response) {
                console.log("Response from content script:", response);
              }
            );
            */
            sendResponse(allSVGArray); // Send the updated SVG string back to the popup


            // contentScript.js
            //chrome.runtime.sendMessage(allSVGArray);

            //sendResponse(msvg[0].outerHTML);
            //const escapeHTMLPolicy = trustedTypes ? trustedTypes.createPolicy("forceInner", { createHTML: (to_escape) => to_escape, }) : { createHTML: (data) => data }; // Fallback if Trusted Types not supported

            // Create a new document to print
            //const fileForExport = escapeHTMLPolicy.createHTML(allSVGHTML);
            //console.log(fileForExport);
            //document.write(fileForExport);
            //console.log("All slides processed. Preparing for print...");

            //setTimeout(() => window.print(), 1000);
            console.log("All slides processed. Preparing for print...");
          } else if (slideCount === null || currentSlide === null) {
            console.error("Could not determine slide information. Aborting.");
          } else {
            if (triggerNextSlide()) {
              console.log(`Processing slide ${currentSlide} of ${slideCount}`);
              setTimeout(processSlide, 500); // Increased delay to allow for slide transition
            } else {
              console.error("Failed to trigger next slide. Aborting.");
            }
          }
        };

        // Start the process
        processSlide();
      })();
      break;
  }
  return true;
});
