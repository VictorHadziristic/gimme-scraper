const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

const puppeteer = require('puppeteer');

const scrapePhysicianByID = async (cpsoNum) => {
    //Setup puppeteer for firebase deployment, (flags for optimization)
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-sandbox',
        '--no-zygote',
        '--single-process',
    ]});
    
    //Load browser
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
    
    //Navigate to page
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
        data["firstName"] = name[1].trim();
        data["lastName"] = name[0].trim();

        //Bundle CPSO Number !FIX!
        let cpsoNo = document.querySelector("#content > div > div > div.col.ml-auto.right_column > div.doctor-details-heading > div.name_cpso_num > h3").textContent;
        data["cpsoNumber"] = cpsoNo.substring(7).trim();

        //Grab Member Status
        let memberStatus = document.querySelector("#content > div > div > div.col.ml-auto.right_column > div.doctor-details-heading > div:nth-child(2) > div.columns.medium-6.text-align--right").textContent;
        memberStatus = memberStatus.trim();
        let memberDelim = memberStatus.indexOf("as of");
        data["registrationStatus"] = memberStatus.substring(0, memberDelim).trim();
        data["registrationEffectiveFrom"] = memberStatus.substring(memberDelim + 7).trim();

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

        //Grab languages
        let languages = document.querySelector("#summary > div.info > p:nth-child(3)").textContent;
        let langStart = languages.indexOf(':') + 5;
        let langEnd = languages.indexOf('\n', langStart);
        languages = languages.substring(langStart,langEnd);
        languages = languages.trim();
        data["languages"] = languages;
        
        //Grab Education
        let education = document.querySelector("#summary > div.info > p:nth-child(4)").textContent;
        let educationStart = education.indexOf(':');
        education = education.substring(educationStart).trim();
        let graduateStart = education.indexOf(',');
        data["graduatedFrom"] = education.substring(1,graduateStart).trim();
        data["yearOfGraduation"] = education.substring(graduateStart + 2).trim();

        //Grab Address
        let fullAddress = document.querySelector("#practice_info > div > div.location_details").innerText.trimLeft().trimRight().split("\n");
        var filtered = fullAddress.filter(function (item){
            return /\d/.test(item);
        });
        fullAddress = filtered;
        var primaryAddress = "";
        var city = "";
        var postalCode = "";
        var phoneNumber = "";
        var faxNumber = "";

        for(var i = 0; i < fullAddress.length; i++){
            if(fullAddress[i].match(/(?:^|\W)Phone:(?:$|\W)/g)){
                phoneNumber = fullAddress[i].substring(6).trim();
            }
            else if(fullAddress[i].match(/(?:^|\W)Fax:(?:$|\W)/g)){
                faxNumber = fullAddress[i].substring(4).trim();
            }
            else{
                if(/(?:^|\W)ON(?:$|\W)/g.test(fullAddress[i])){
                    let details = fullAddress[i].replace(/[\W_]+/g," ").split(' ');
                    city = details[0] + " " + details[1];
                    postalCode = details[2] + " " + details[3];
                    primaryAddress += fullAddress[i];
                }else{
                    primaryAddress += fullAddress[i] + " ";
                }
            }
        }
        
        data["primaryAddress"] = primaryAddress;
        data["city"] = city;
        data["postalCode"] = postalCode;
        data["phoneNumber"] = phoneNumber;
        data["faxNumber"] = faxNumber;

        //Grab hospital privleges
        let privelegeData = "";
        let hospitalTable = "";
        try{
            hospitalTable = document.querySelector("#hospital_priv > table > tbody");
            let rows = Array.from(hospitalTable.children);
            let numOfRecords = rows.length;
            privelegeData = [];
            //Row control
            for(var i = 1; i < numOfRecords + 1; i++){
                let record = ""
                //Column control
                for(var j = 1; j < 3; j++){
                    let cell = document.querySelector("#hospital_priv > table > tbody > tr:nth-child(" + i + ") > td:nth-child(" + j + ")");
                    if(j == 1){
                        record = cell.textContent;
                    }else{
                        record += " (" + cell.textContent + ")";
                    }
                }
                privelegeData.push(record);
            }
            let privelegeOutput = "";
            for(var i = 0; i < numOfRecords; i++){
                privelegeOutput += " " + (i + 1) + ". " + privelegeData[i].toString();
            }
            data["hospitalPrivileges"] = privelegeOutput.trim();
        }catch(err){
            privelegeData = "";
        }

        //Grab specialties
        let specialtyData = "";
        let specialtyTable = "";
        try{
            specialtyTable = document.querySelector("#specialties > table > tbody")
            let rows = Array.from(specialtyTable.children);
            let numOfRecords = rows.length;
            specialtyData = [];
            //Row control
            if(numOfRecords > 1){
                for(var i = 1; i < numOfRecords + 1; i++){
                    let record = "";
                    //Column control
                    for(var j = 1; j < 4; j++){
                        let cell = document.querySelector("#specialties > table > tbody > tr:nth-child(" + i + ") > td:nth-child(" + j + ")")
                        if(j == 1){
                            record = cell.textContent;
                        }
                        else{
                            record += " " + cell.textContent + " ";
                        }
                    }
                    specialtyData.push(record);
                }
            }else{
                let record = "";
                //Column control
                for(var j = 1; j < 4; j++){
                    let cell = document.querySelector("#specialties > table > tbody > tr > td:nth-child(" + j + ")")
                    if(j == 1){
                        record = cell.textContent;
                    }
                    else{
                        record += " " + cell.textContent + " ";
                    }
                }
                specialtyData.push(record);
            }
            
            let specialtyOutput = "";
            for(var i = 0; i < numOfRecords; i++){
                specialtyOutput += " " + (i + 1) + ". " + specialtyData[i].toString();
            }
            data["specialties"] = specialtyOutput.trim();
        }catch(err){
            specialtyData = "";
        }

        return data;
    });
  
    await browser.close();

    return data;
}

//To execute: https://us-central1-gimmescraper.cloudfunctions.net/scraper
exports.scraper = functions
    .runWith({memory: '2GB'})
    .https.onRequest((request, response) => {
        cors(request, response, async () => {
            const data = await scrapePhysicianByID(request.body.cpsoNum);
            response.send(data);
    });
});