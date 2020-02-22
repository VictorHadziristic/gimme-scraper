const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

const puppeteer = require('puppeteer');

const scrapePhysicianByID = async (cpsoNum) => {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

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
    
    await page.goto('https://www.cpso.on.ca/');

    // Search for physician by id
    await page.type('[id=txtPhysCPSONum]', cpsoNum);
    await page.click("#content > div.container-fluid.no_padding.find_a_doc_hover_outer_container > div > div > div.col.find_a_doc_search_inputs > div > div.col.phys_submit > a");

    // Wait for physician profile to load
    await page.waitForSelector('h1[id=docTitle]', {
        visible: true,
    });

    // Grab physician details
    const data = await page.evaluate( () => {
        //Create new JSON object to contain physician details
        var data = {};
        
        //Grab first name and last name
        let name = document.querySelector('h1[id=docTitle]').textContent.split(', ');
        data["firstName"] = name[0].trim();
        data["lastName"] = name[1].trim();

        //Bundle CPSO Number !FIX!
        //data["cpsoNumber"] = cpsoNum;

        //Grab Registration Class and Certificate Issue
        let registration = document.querySelector("#content > div > div > div.col.ml-auto.right_column > div.doctor-details-heading > div:nth-child(3) > div.columns.medium-6.text-align--right").textContent;
        registration = registration.trim();
        let registrationDelim = registration.indexOf("as of");
        data["registrationClass"] = registration.substring(0, registrationDelim).trim();
        data["certificateIssueDate"] = registration.substring(registrationDelim + 7).trim();

        //Grab gender
        let gender = document.querySelector("#summary > div.info > p:nth-child(2)").textContent;
        if(gender.match(/(?:^|\W)Male(?:$|\W)/g)){
            data["gender"] = "Male";
        }
        if(gender.match(/(?:^|\W)Female(?:$|\W)/g)){
            data["gender"] = "Female";
        }

        let languages = document.querySelector("#summary > div.info > p:nth-child(3)").textContent;
        let langStart = languages.indexOf(':') + 5;
        let langEnd = languages.indexOf('\n', langStart);
        languages = languages.substring(langStart,langEnd);
        languages = languages.trim();
        data["Languages"] = languages;         

        return data;
    });
  
    await browser.close();

    console.log(data);

    return data;
}

exports.scraper = functions
    .runWith({memory: '2GB'})
    .https.onRequest((request, response) => {
        cors(request, response, async () => {
            const data = await scrapePhysicianByID(request.body.cpsoNum);
            response.send(data);
    });
});