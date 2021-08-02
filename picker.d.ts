import Vue, { PluginFunction, VueConstructor } from 'vue';

declare const Picker: VueConstructor<Vue> & { install: PluginFunction<any>; };
export default Picker;
