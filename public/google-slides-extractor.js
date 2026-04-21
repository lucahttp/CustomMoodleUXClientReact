// Google Slides SVG Extractor — Content Script
// Injected into docs.google.com/presentation/* iframes via manifest.json.
// Communicates with the parent Moodle page using window.postMessage (Iframe RPC).

window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "getText") {
        console.log("Comenzando extracción SVG...");
        (async () => {
            const msvg = document.getElementsByTagName("svg");
            console.log("SVG elements found:", msvg);
            if (!msvg.length) {
                console.error("No SVG elements found.");
                window.parent.postMessage({ type: "SLIDES_ERROR", error: "No SVG elements found" }, "*");
                return;
            }

            let slideCount = null;
            let currentSlide = null;
            let allSVGArray = [];

            const getSlideInfo = () => {
                const sizeElement = document.querySelector("[data-slide-count]");
                const positionElement = document.querySelector("[data-current-slide]");
                if (sizeElement && positionElement) {
                    slideCount = parseInt(sizeElement.getAttribute("data-slide-count"), 10);
                    currentSlide = parseInt(positionElement.getAttribute("data-current-slide"), 10);
                    return true;
                }
                const ariaSizeElement = document.querySelector("[aria-setsize]");
                const ariaPositionElement = document.querySelector("[aria-posinset]");
                if (ariaSizeElement && ariaPositionElement) {
                    slideCount = parseInt(ariaSizeElement.getAttribute("aria-setsize"), 10);
                    currentSlide = parseInt(ariaPositionElement.getAttribute("aria-posinset"), 10);
                    return true;
                }
                return false;
            };

            const triggerNextSlide = () => {
                const viewerContainer = document.querySelector(".sketchyViewerContainer")?.childNodes[0]?.childNodes[0];
                if (viewerContainer) {
                    viewerContainer.click();
                    return true;
                }
                return false;
            };

            const processSlide = () => {
                if (msvg[0]) {
                    allSVGArray[currentSlide] = msvg[0].outerHTML;
                }

                if (getSlideInfo() && currentSlide === slideCount) {
                    window.parent.postMessage({ type: "SLIDES_EXTRACTED", data: allSVGArray }, "*");
                } else if (slideCount === null || currentSlide === null) {
                    window.parent.postMessage({ type: "SLIDES_ERROR", error: "No se determinó información de las diapositivas." }, "*");
                } else {
                    if (triggerNextSlide()) {
                        setTimeout(processSlide, 750);
                    } else {
                        window.parent.postMessage({ type: "SLIDES_ERROR", error: "Error iterando a la siguiente diapositiva." }, "*");
                    }
                }
            };

            processSlide();
        })();
    }
});
