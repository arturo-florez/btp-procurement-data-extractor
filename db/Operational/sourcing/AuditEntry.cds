namespace sap.ariba;

using {managed} from '@sap/cds/common';

using sap.ariba.type as types from '../../types';

/**
    Name:        Audit Entry
    Description: Sourcing Audit Entry log
*/

entity AuditEntry_OP : managed {
    key Realm          : String(50);
    key Id             : Int64;
        EffectiveUser  : types.effectiveUser;
        Parameters     : types.parameters;
        LineId         : String(30);
        NodeName       : String(50);
        ContextObject  : types.contextObject;
        TimeUpdated    : DateTime;
        Template       : types.template;
        TimeCreated    : DateTime;
        Active         : Boolean;
        IsSystem       : Boolean;
        Level          : Double;
        ContextVersion : Double;
        RealUser       : types.effectiveUser;
}
