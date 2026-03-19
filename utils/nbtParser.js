export const decToHex = (dec) => {
    if (!dec) return "#ffffff";
    return "#" + (dec & 0xFFFFFF).toString(16).padStart(6, '0');
};

export const cleanLore = (loreList) => {
    if (!loreList) return [];
    return loreList.map(line => line.toString().replace(/§/g, "&"));
};
