"use strict";

const cds = require("@sap/cds");
const logger = cds.log('logger');
const utils = require("../../../utils/Utils");


//Amount fields in object
function _getAmountPropertiesForDataCleaning () {
    return [    ];
}

function _mapEntityStructure (oDataCleansed) {

    //Flattening TaskApprovable
    oDataCleansed["ApprovalRequests"]= oDataCleansed.TaskApprovable && oDataCleansed.TaskApprovable.ApprovalRequests?oDataCleansed.TaskApprovable.ApprovalRequests:null;
    delete oDataCleansed.TaskApprovable;

    //Removing formdetails
    oDataCleansed.DocumentId && oDataCleansed.DocumentId.ariba_FormDetails && delete oDataCleansed.DocumentId.ariba_FormDetails; 
   
    //Normalize Approver property of Approver as an arry of approver
    if (oDataCleansed && oDataCleansed.Approver){
        for(let i=0; i< oDataCleansed.Approver.length; i++){
            let oApprovers = oDataCleansed.Approver[i].Approver instanceof  Array ? 
                oDataCleansed.Approver[i].Approver.map((elt)=>{return elt}):
                new Array (oDataCleansed.Approver[i].Approver);
            delete oDataCleansed.Approver[i].Approver;
            oDataCleansed.Approver[i]["Approver"] = oApprovers;
        }
    }

    // Normalize nested ApprovalRequests -> Approver (can arrive as object but CDS expects array for deep insert of composition)
    if (oDataCleansed && Array.isArray(oDataCleansed.ApprovalRequests)) {
        for (let i = 0; i < oDataCleansed.ApprovalRequests.length; i++) {
            const req = oDataCleansed.ApprovalRequests[i];
            if (req && req.Approver) {
                // In some payloads Approver is delivered as single object instead of array
                if (!(req.Approver instanceof Array)) {
                    req.Approver = [ req.Approver ];
                } else {
                    // ensure plain mapping (clone) to avoid accidental shared references
                    req.Approver = req.Approver.map(a => a); 
                }
            }
        }
    }

    // Defensive: remove any falsely flattened foreign key artifacts that could be null (would violate NOT NULL on association FKs)
    // We only keep the composition arrays; CAP will derive the foreign keys (DocumentTask_* columns) automatically.
    // If previous processing introduced spurious keys like DocumentTask_Realm inside children, they are safe; we don't delete explicitly here.

    return oDataCleansed;
   
}
function insertData(aData, realm)  {
    return new Promise(async function(resolve, reject)    {
   

        if (!aData || aData.length === 0) {
            resolve(0);
            return;
        }
        logger.info(`Processing ${aData.length} records`);
        var aCleaningProperties = _getAmountPropertiesForDataCleaning();
        let i=0;
        for(const oData of aData) {
            
            var oDataCleansed = utils.cleanData(aCleaningProperties, oData, realm);

            // Remove null properties
            oDataCleansed = utils.deleteCustomFields(oDataCleansed);
            oDataCleansed = utils.removeNullValues(oDataCleansed);
            oDataCleansed= _mapEntityStructure(oDataCleansed);
            oDataCleansed = utils.flattenTypes(oDataCleansed);


            try {
                //Full load behaviour for all records
                let sRealm = realm;
                let sInternalId = oDataCleansed.InternalId;

                //1 Delete potential record dependencies
                try {
                    await DELETE("sap.ariba.DocumentTask_Approver_OP").where({
                        DocumentTask_Realm : sRealm ,
                        DocumentTask_InternalId : sInternalId
                    });
                    await DELETE("sap.ariba.DocumentTask_ActiveApprovers_OP").where({
                        DocumentTask_Realm : sRealm ,
                        DocumentTask_InternalId : sInternalId
                    });
                    await DELETE("sap.ariba.DocumentTask_ApprovalRequests_OP").where({
                        DocumentTask_Realm : sRealm ,
                        DocumentTask_InternalId : sInternalId
                    });
                    await DELETE("sap.ariba.DocumentTask_OP").where({
                        Realm : sRealm ,
                        InternalId : sInternalId
                    });
                
                }
                catch(e){
                    logger.error(`Error on deleting from database, aborting file processing, details ${e} `);
                    reject(e);
                }

                //New record, insert
                await INSERT .into ("sap.ariba.DocumentTask_OP") .entries (oDataCleansed) ;
                         
           
            } catch (e) {                
                logger.error(`Error on inserting data in database, aborting file processing, details ${e} `);
                console.log(JSON.stringify(oDataCleansed));
                //abort full file
                reject(e);
                break;
            }
            //Monitoring
            i++;
            if(i%500 ==0){
                logger.info(`Upsert ${i} records`);
            }

        }
        resolve(aData.length);
    });

}



module.exports = {
    insertData
}