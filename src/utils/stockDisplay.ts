export function inventorySectionLabel(name: string) {
 const key=name.trim().toLowerCase();
 if (/^(beverages?|baverages?)$/.test(key)) return "Barista";
 if (key === "kitchen") return "Kitchen";
 if (/^others?$/.test(key)) return "Waiters";
 return name;
}
function unitDefinition(code: string): {dimension: string; factor: number} | undefined {
 const key=code.trim().toLowerCase();
 if (["g","gr","gram","grams"].includes(key)) return {dimension:"mass",factor:1};
 if (["kg","kilogram"].includes(key)) return {dimension:"mass",factor:1000};
 if (["ml","milliliter"].includes(key)) return {dimension:"volume",factor:1};
 if (["l","liter","litre"].includes(key)) return {dimension:"volume",factor:1000};
 if (["pcs","pc","piece"].includes(key)) return {dimension:"count",factor:1};
 return undefined;
}
export function stockDisplayUnits(base: string, packaging: string, contentUnit: string, contentQty: number, packageQty: number) {
 const choices=[{key:"base",label:base,divisor:1}];
 const definition=unitDefinition(base);
 if (definition?.dimension === "mass") choices.push({key:"converted",label:definition.factor===1 ? "KG" : "GR",divisor:definition.factor===1 ? 1000 : 0.001});
 if (definition?.dimension === "volume") choices.push({key:"converted",label:definition.factor===1 ? "L" : "ML",divisor:definition.factor===1 ? 1000 : 0.001});
 const content=unitDefinition(contentUnit);
 const sameUnit=base.trim().toLowerCase()===contentUnit.trim().toLowerCase();
 const ratio=definition && content && definition.dimension===content.dimension ? content.factor/definition.factor : sameUnit ? 1 : 0;
 if (packaging && contentQty>0 && packageQty>0 && ratio>0) {
  const divisor=contentQty*ratio/packageQty;
  const packagingDefinition=unitDefinition(packaging);
  const sameLabel=(label: string) => {
   const existing=unitDefinition(label);
   return label.trim().toLowerCase()===packaging.trim().toLowerCase() || Boolean(existing && packagingDefinition && existing.dimension===packagingDefinition.dimension && existing.factor===packagingDefinition.factor);
  };
  const duplicate=choices.some((choice) => sameLabel(choice.label) && Math.abs(choice.divisor-divisor)<=1e-9*Math.max(choice.divisor,divisor));
  if (!duplicate) choices.push({key:"package",label:choices.some((choice) => sameLabel(choice.label)) ? `${packaging} (kemasan)` : packaging,divisor});
 }
 return choices;
}
