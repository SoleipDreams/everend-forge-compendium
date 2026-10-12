import { describe, expect, it } from "vitest";
import { mergeUniverseProfile } from "../src/universeProfilePersistence";
import { findSettings } from "../src/settingsIntegration";
import { compendiumSettingsPages } from "../src/settingsCatalog";
describe("Settings profile and bilingual search", () => {
it("edits identity without losing languages or unknown profile fields", () => {
const profile={name:"Before",schemaVersion:7,localization:{primaryLocale:"es",locales:["es","en","x-stellar"],localeNames:{"x-stellar":"Stellar"},extension:{keep:true}},extension:{portable:true}};
expect(mergeUniverseProfile(JSON.stringify(profile),{name:"After",icon:{type:"preset",value:"book"}})).toEqual({...profile,name:"After",icon:{type:"preset",value:"book"}});
});
it("retains localization extensions when languages are explicitly edited",()=>expect(mergeUniverseProfile(JSON.stringify({localization:{primaryLocale:"en",extension:true}}),{localization:{primaryLocale:"es",locales:["es"]}})).toEqual({localization:{primaryLocale:"es",locales:["es"],extension:true}}));
it("rejects damaged profiles instead of replacing them",()=>{for(const value of ["null","[]","5","{"])expect(()=>mergeUniverseProfile(value,{name:"A"})).toThrow();});
it("finds controls across interface languages and accents",()=>{
expect(findSettings(compendiumSettingsPages,"FUENTE DE LECTÚRA").map(result=>result.control.id)).toContain("compendium.appearance.font");
expect(findSettings(compendiumSettingsPages,"universe name")[0].page.requiresUniverse).toBe(true);
expect(findSettings(compendiumSettingsPages,"no-such-setting")).toEqual([]);
});
});
