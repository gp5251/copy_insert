// 导出配置管理函数
const configManagement = {
  getAllProfiles: (configStore) => {
    return {
      profiles: configStore.get('profiles'),
      activeProfile: configStore.get('activeProfile')
    };
  },
  
  saveProfile: (configStore, profileName, config) => {
    const profiles = configStore.get('profiles') || {};
    profiles[profileName] = config;
    configStore.set('profiles', profiles);
    return { success: true };
  },
  
  applyProfile: (store, configStore, profileName) => {
    const profiles = configStore.get('profiles') || {};
    if (profiles[profileName]) {
      store.set('config', profiles[profileName]);
      configStore.set('activeProfile', profileName);
      return { success: true, config: profiles[profileName] };
    }
    return { success: false, message: '配置项不存在' };
  },
  
  deleteProfile: (store, configStore, profileName) => {
    const profiles = configStore.get('profiles') || {};
    const activeProfile = configStore.get('activeProfile');
    
    if (profileName === 'default') {
      return { success: false, message: '不能删除默认配置' };
    }
    
    if (profiles[profileName]) {
      delete profiles[profileName];
      configStore.set('profiles', profiles);
      
      // 如果删除的是当前激活的配置，则切换到默认配置
      if (activeProfile === profileName) {
        configStore.set('activeProfile', 'default');
        store.set('config', profiles['default']);
      }
      
      return { success: true };
    }
    return { success: false, message: '配置项不存在' };
  }
};

module.exports = { configManagement }; 