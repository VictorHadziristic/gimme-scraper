![Gimme! Logo](https://s3.amazonaws.com/poly-screenshots.angel.co/Project/99/1114760/2e9a202b762c301fe85eeea1df8cdbf5-original.png)

# What is Gimme!
Gimme! is a web scraper tool specifically targeted at [The College of Physicians and Surgeons of Ontario](https://www.cpso.on.ca/). This tool is currently in development, but will include a number of functionalities, listed below.

## What can / will this tool do?
1. Allow the user to specify a particular physican (by CPSO number) and retrieve a variety of data fields, returned as a JSON object. [Implemented]
2. Grab all CPSO numbers that belong to a particular FSA (Forward Sortation Area, the first 3 alpha-numeric characters of a valid Ontario postal code) [Future implementation]
3. Grab all information for all Ontario physicians,  [Future implementation]
4. More features to come, as I think of them.

## How does Gimme! work?
Gimme! currently uses Firebase Cloud Functions (which is really Google Cloud Functions) to spawn an instance of headless Chromium (essentially a instance of a chrome browser) on the cloud. Within this browser instance, the code automates the
process of navigating to a webpage, scraping relevant information and cleaning up the raw output for storage within a JSON object. This process is accomplished using the Puppeteer library.

## What is the tech stack of this project?
* Firebase Cloud Functions
* Node.js
* Puppeteer

## Notes on optimization
This is a rather intensive process to have a cloud function perform, this is made evident by the initial tests of the service. In initial tests of the service, scraping a single physcian's info page
took over 10 seconds to complete! This was a rather dissapointing show of performance. Upon further research into browser automation and cloud function configuration, I made several tweaks which got the
execution time to under or around 3 seconds. Firstly, I provided more memory to the cloud function (currently set to 2 gigabytes of memory, unsurprisingly, chrome requires a lot of memory). Secondly, the following
flags are set in Puppeteer to optimize chromium's operation.
```
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-setuid-sandbox',
  '--no-first-run',
  '--no-sandbox',
  '--no-zygote',
  '--single-process',
 ```
 
 Finally, the following parameters were set to intercept the HTTP requests for stylesheets, fonts and other unnecessary assets, further increasing the efficiency of the service
 ```
 //Stop page from loading stylesheets, fonts or images (optimization)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if(req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image'){
            req.abort();
        }
        else {
            req.continue();
        }
    });
```
