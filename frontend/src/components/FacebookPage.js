/* eslint-disable no-undef */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { fileToBase64, MediaIcon, cleanupFacebookSDK, loadFacebookSDK } from './FacebookUtils';
import './FacebookPage.css';

function FacebookPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  // Core state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [selectedPage, setSelectedPage] = useState(null);
  const [availablePages, setAvailablePages] = useState([]);
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('auto');
  const [cardFlipped, setCardFlipped] = useState(false);
  const [existingConnections, setExistingConnections] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  
  // Form states
  const [autoFormData, setAutoFormData] = useState({
    prompt: '',
    mediaType: 'none',
    mediaFile: null,
    generatedContent: '',
    isGenerating: false,
    imagePrompt: '',
    generatedImageUrl: null,
    generatedImageFilename: null,
    isGeneratingImage: false
  });
  
  const [scheduleData, setScheduleData] = useState({
    prompt: '',
    time: '',
    frequency: 'daily',
    customDate: '',
    isActive: false,
    scheduleId: null
  });
  
  const [manualFormData, setManualFormData] = useState({
    message: '',
    mediaType: 'none',
    mediaFile: null
  });

  // UI states
  const [isPublishing, setIsPublishing] = useState(false);
  const [autoPostHistory, setAutoPostHistory] = useState([]);
  const [manualPostHistory, setManualPostHistory] = useState([]);
  const [schedulePostHistory, setSchedulePostHistory] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isTogglingSchedule, setIsTogglingSchedule] = useState(false);
  
  // Pagination states
  const [schedulePage, setSchedulePage] = useState(1);
  const [scheduleTotalPages, setScheduleTotalPages] = useState(1);
  const [scheduleTotalCount, setScheduleTotalCount] = useState(0);

  // File picker modal states
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerType, setFilePickerType] = useState(''); // 'photo' or 'video'
  const [filePickerFormType, setFilePickerFormType] = useState(''); // 'auto' or 'manual'
  const [isLoadingGoogleDrive, setIsLoadingGoogleDrive] = useState(false);
  const [googleDriveAvailable, setGoogleDriveAvailable] = useState(false);

  // Auto-reply states
  const [autoReplySettings, setAutoReplySettings] = useState({
    enabled: false,
    template: 'Thank you for your comment! We appreciate your engagement. 😊',
    isLoading: false,
    showSettings: false,
    selectedPostIds: [],
    availablePosts: [],
    isLoadingPosts: false
  });

  const FACEBOOK_APP_ID = process.env.REACT_APP_FACEBOOK_APP_ID || '1526961221410200';

  // Mobile detection utility
  const isMobile = () => window.innerWidth <= 768;
  const isSmallMobile = () => window.innerWidth <= 480;

  // Check for existing Facebook connections on component mount
  useEffect(() => {
    checkExistingFacebookConnections();
    checkGoogleDriveAvailability();
    
    // Add mobile-specific event listeners
    const handleResize = () => {
      // Force re-render on resize for mobile responsiveness
      setConnectionStatus(prev => prev);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      setIsConnecting(false);
      setIsPublishing(false);
      setIsLoggingOut(false);
      setIsCheckingStatus(false);
    };
  }, []);

  const checkGoogleDriveAvailability = async () => {
    try {
      const { authenticated } = await apiClient.getGoogleDriveStatus();
      setGoogleDriveAvailable(authenticated);
    } catch (error) {
      console.warn('Drive status check failed:', error.message);
      setGoogleDriveAvailable(false);
    }
  };

  const openDriveAuthPopup = (authUrl) => {
    return new Promise((resolve, reject) => {
      // Mobile-friendly popup sizing
      const isMobile = window.innerWidth <= 768;
      const w = isMobile ? Math.min(400, window.innerWidth - 40) : 500;
      const h = isMobile ? Math.min(600, window.innerHeight - 40) : 600;
      const left = (window.outerWidth - w) / 2;
      const top = (window.outerHeight - h) / 2;

      const popup = window.open(
        authUrl,
        'DriveAuth',
        `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        reject(new Error('Popup blocked'));
        return;
      }

      // Listen for messages from the popup
      const messageHandler = (event) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.success) {
          window.removeEventListener('message', messageHandler);
          resolve();
        } else if (event.data.error) {
          window.removeEventListener('message', messageHandler);
          reject(new Error(event.data.error));
        }
      };

      window.addEventListener('message', messageHandler);

      // Also poll for popup closure as fallback
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener('message', messageHandler);
          resolve(); // Assume success if popup closed without error message
        }
      }, 500);
    });
  };

  // Load posts when page is selected or tab changes
  useEffect(() => {
    if (selectedPage && facebookConnected) {
      loadPostHistory();
      loadAutoReplySettings(); // Load auto-reply settings when page is selected
      loadScheduledPosts(1); // Load scheduled posts and schedule data (reset to page 1)
    }
  }, [selectedPage, facebookConnected, activeTab]);

  const loadScheduledPosts = async (page = 1) => {
    if (!selectedPage) return;
    
    try {
      // Load scheduled posts from backend
      const scheduledPostsResponse = await apiClient.getScheduledPosts();
      console.log('📅 Loaded scheduled posts:', scheduledPostsResponse);
      
      // Filter scheduled posts for the current page
      const pageScheduledPosts = scheduledPostsResponse.filter(post => {
        // Match by social account ID or platform user ID
        return post.social_account?.platform_user_id === selectedPage.id || 
               post.social_account?.id === selectedPage.internalId;
      });
      
      console.log('📅 Page scheduled posts:', pageScheduledPosts);
      
      // Calculate pagination
      const postsPerPage = 10;
      const totalCount = pageScheduledPosts.length;
      const totalPages = Math.ceil(totalCount / postsPerPage);
      const startIndex = (page - 1) * postsPerPage;
      const endIndex = startIndex + postsPerPage;
      
      // Update pagination state
      setScheduleTotalCount(totalCount);
      setScheduleTotalPages(totalPages);
      setSchedulePage(page);
      
      // Update schedule post history with pagination
      setSchedulePostHistory(pageScheduledPosts.slice(startIndex, endIndex));
      
      // Check if there's an active schedule for this page
      const activeSchedule = pageScheduledPosts.find(post => post.is_active);
      
      if (activeSchedule) {
        // Update schedule data with the active schedule
        setScheduleData(prev => ({
          ...prev,
          prompt: activeSchedule.prompt,
          time: activeSchedule.post_time,
          frequency: activeSchedule.frequency,
          isActive: true,
          scheduleId: activeSchedule.id,
          customDate: activeSchedule.frequency === 'custom' ? activeSchedule.post_time : ''
        }));
        console.log('✅ Active schedule found and loaded:', activeSchedule);
      } else {
        // Only reset if we don't have a local active state that we're trying to maintain
        setScheduleData(prev => {
          // If we're in the middle of a toggle operation, don't override the state
          if (prev.isActive && prev.scheduleId) {
            console.log('🔄 Keeping local active state during operation');
            return prev;
          }
          
          return {
            ...prev,
            isActive: false,
            scheduleId: null
          };
        });
        console.log('❌ No active schedule found for this page');
      }
      
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
      // Keep current state on error
    }
  };

  const checkExistingFacebookConnections = async () => {
    try {
      setIsCheckingStatus(true);
      const response = await apiClient.getFacebookStatus();
      
      if (response.connected) {
        setExistingConnections(response);
        setFacebookConnected(true);
        
        let socialAccounts = [];
        let facebookAccounts = [];
        
        try {
          socialAccounts = await apiClient.getSocialAccounts();
          facebookAccounts = socialAccounts.filter(acc => 
            acc.platform === 'facebook' && acc.is_connected
          );
        } catch (accountsError) {
          console.warn('Failed to fetch social accounts:', accountsError);
        }
        
        const pagesFromBackend = response.accounts.pages.map(page => {
          const matchingAccount = facebookAccounts.find(acc => 
            acc.platform_user_id === page.platform_id
          );
          
          return {
            id: page.platform_id,
            internalId: matchingAccount?.id,
            name: page.name,
            category: page.category,
            access_token: '',
            profilePicture: page.profile_picture || '',
            canPost: page.can_post,
            canComment: page.can_comment,
            followerCount: page.follower_count
          };
        });
        
        setAvailablePages(pagesFromBackend);
        
        if (pagesFromBackend.length === 1) {
          setSelectedPage(pagesFromBackend[0]);
          // Load auto-reply settings for the single page
          setTimeout(() => loadAutoReplySettings(), 500);
        }
        
        setCardFlipped(true);
        setConnectionStatus(`Connected! ${response.pages_count} Facebook page(s) available.`);
      } else {
        setConnectionStatus('Ready to connect your Facebook account');
      }
    } catch (error) {
      console.error('Error checking Facebook status:', error);
      setConnectionStatus('Unable to check Facebook connection status');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleFacebookLogout = async () => {
    try {
      // Check for active schedules before disconnecting
      if (selectedPage && scheduleData.isActive) {
        const confirmDisconnect = window.confirm(
          `⚠️ Warning: You have an active schedule for "${selectedPage.name}". Disconnecting will deactivate this schedule. Do you want to continue?`
        );
        
        if (!confirmDisconnect) {
          return;
        }
        
        // Deactivate the schedule before disconnecting
        try {
          await apiClient.deleteScheduledPost(scheduleData.scheduleId);
          console.log('✅ Schedule deactivated before disconnect');
        } catch (scheduleError) {
          console.warn('Failed to deactivate schedule before disconnect:', scheduleError);
        }
      }
      
      setIsLoggingOut(true);
      setConnectionStatus('Disconnecting from Facebook...');
      
      await apiClient.logoutFacebook();
      
      setFacebookConnected(false);
      setExistingConnections(null);
      setAvailablePages([]);
      setSelectedPage(null);
      setCardFlipped(false);
      setAutoPostHistory([]);
      setManualPostHistory([]);
      setSchedulePostHistory([]);
      
      // Reset schedule data
      setScheduleData({
        prompt: '',
        time: '',
        frequency: 'daily',
        customDate: '',
        isActive: false,
        scheduleId: null
      });
      
      setConnectionStatus('Successfully disconnected from Facebook');
      
      setTimeout(() => {
        setConnectionStatus('Ready to connect your Facebook account');
      }, 3000);
      
    } catch (error) {
      console.error('Error logging out from Facebook:', error);
      setConnectionStatus('Failed to disconnect from Facebook: ' + error.message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const loadPostHistory = async () => {
    if (!selectedPage) return;
    
    try {
      setIsLoadingPosts(true);
      const response = await apiClient.getSocialPosts('facebook');
      const posts = response.slice(0, 10);
      
      // Separate posts by type - only auto and manual posts here
      // Scheduled posts are handled separately in loadScheduledPosts()
      setAutoPostHistory(posts.filter((_, index) => index % 2 === 0));
      setManualPostHistory(posts.filter((_, index) => index % 2 === 1));
      // Note: schedulePostHistory is now managed by loadScheduledPosts()
    } catch (error) {
      console.error('Error loading post history:', error);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const getCurrentPostHistory = () => {
    switch (activeTab) {
      case 'auto':
        return autoPostHistory;
      case 'manual':
        return manualPostHistory;
      case 'schedule':
        return schedulePostHistory;
      default:
        return autoPostHistory;
    }
  };

  const handleScheduleToggle = async () => {
    if (!selectedPage) {
      setConnectionStatus('Please select a page first');
      return;
    }

    if (!scheduleData.prompt || (!scheduleData.time && scheduleData.frequency !== 'custom')) {
      setConnectionStatus('Please fill in prompt and time before activating schedule');
      return;
    }

    if (isTogglingSchedule) {
      return; // Prevent multiple rapid clicks
    }

    let internalAccountId = selectedPage.internalId;
    
    if (!internalAccountId) {
      try {
        const socialAccounts = await apiClient.getSocialAccounts();
        const facebookAccounts = socialAccounts.filter(acc => 
          acc.platform === 'facebook' && acc.is_connected
        );
        
        const matchingAccount = facebookAccounts.find(acc => 
          acc.platform_user_id === selectedPage.id
        );
        
        if (matchingAccount) {
          internalAccountId = matchingAccount.id;
          setSelectedPage(prev => ({
            ...prev,
            internalId: matchingAccount.id
          }));
        } else {
          setConnectionStatus('Unable to find account information. Please reconnect your Facebook account.');
          return;
        }
      } catch (error) {
        console.error('Failed to fetch account information:', error);
        setConnectionStatus('Unable to find account information. Please reconnect your Facebook account.');
        return;
      }
    }

    try {
      setIsTogglingSchedule(true);
      
      if (!scheduleData.isActive) {
        setConnectionStatus('Creating scheduled post...');
        
        const postTime = scheduleData.frequency === 'custom' ? scheduleData.customDate : scheduleData.time;
        
        const response = await apiClient.createScheduledPost({
          prompt: scheduleData.prompt,
          post_time: postTime,
          frequency: scheduleData.frequency,
          social_account_id: internalAccountId
        });

        setScheduleData(prev => ({ 
          ...prev, 
          isActive: true,
          scheduleId: response.data.id
        }));
        
        setConnectionStatus('Schedule activated successfully! Posts will be published automatically.');
        
        // Reload scheduled posts to update the UI
        setTimeout(() => {
          loadScheduledPosts(1);
        }, 1000);
        
      } else {
        if (scheduleData.scheduleId) {
          setConnectionStatus('Deactivating schedule...');
          // Use deactivate endpoint instead of delete
          await apiClient.deactivateScheduledPost(scheduleData.scheduleId);
          setConnectionStatus('Schedule deactivated successfully');
        }
        
        // Immediately update local state
        setScheduleData(prev => ({ 
          ...prev, 
          isActive: false,
          scheduleId: null
        }));
        
        // Reload scheduled posts to update the UI
        setTimeout(() => {
          loadScheduledPosts(1);
        }, 1000);
      }
      
    } catch (error) {
      console.error('Schedule toggle error:', error);
      
      // Handle specific error for existing active schedule
      if (error.message && error.message.includes('active schedule already exists')) {
        setConnectionStatus('An active schedule already exists. Please deactivate it first.');
        // Reload to show the existing active schedule
        setTimeout(() => {
          loadScheduledPosts(1);
        }, 1000);
      } else {
        setConnectionStatus('Failed to update schedule: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setIsTogglingSchedule(false);
    }
  };

  const handleAutoReplyToggle = async () => {
    if (!selectedPage) {
      setConnectionStatus('Please select a page first');
      return;
    }

    // Check if posts are selected when enabling
    if (!autoReplySettings.enabled && autoReplySettings.selectedPostIds.length === 0) {
      setConnectionStatus('Please select at least one post to enable auto-reply');
      return;
    }

    // Add mobile-friendly confirmation for enabling auto-reply
    if (!autoReplySettings.enabled) {
      const isMobile = window.innerWidth <= 768;
      const confirmMessage = isMobile 
        ? `Enable auto-reply for ${autoReplySettings.selectedPostIds.length} post(s)?`
        : `Enable auto-reply for ${autoReplySettings.selectedPostIds.length} post(s)? AI will automatically reply to comments mentioning the commenter.`;
      
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    try {
      console.log('🔄 Toggling auto-reply for page:', selectedPage.id, selectedPage.name);
      console.log('📝 Selected post IDs:', autoReplySettings.selectedPostIds);
      console.log('🎯 New state will be:', !autoReplySettings.enabled);
      
      setAutoReplySettings(prev => ({ ...prev, isLoading: true }));
      setConnectionStatus(autoReplySettings.enabled ? 'Disabling auto-reply...' : 'Enabling auto-reply...');

      const response = await apiClient.toggleAutoReply(
        selectedPage.id,
        !autoReplySettings.enabled,
        autoReplySettings.template || '', // Use empty string if no template
        autoReplySettings.selectedPostIds
      );

      console.log('📡 Backend response:', response);

      if (response.success) {
        setAutoReplySettings(prev => ({
          ...prev,
          enabled: !prev.enabled,
          isLoading: false,
          ruleId: response.data?.rule_id || prev.ruleId // Store the rule ID
        }));
        
        console.log('✅ Auto-reply toggled successfully:', {
          enabled: !autoReplySettings.enabled,
          ruleId: response.data?.rule_id,
          selectedPostsCount: response.data?.selected_posts_count
        });
        
        const successMessage = !autoReplySettings.enabled 
          ? isMobile()
            ? `Auto-reply enabled for ${response.data?.selected_posts_count || 0} post(s)!`
            : `Auto-reply enabled successfully for ${response.data?.selected_posts_count || 0} post(s)! AI will automatically reply to comments mentioning the commenter.`
          : 'Auto-reply disabled successfully.';
        
        setConnectionStatus(successMessage);
      } else {
        throw new Error(response.error || 'Failed to toggle auto-reply');
      }
    } catch (error) {
      console.error('❌ Auto-reply toggle error:', error);
      setConnectionStatus('Failed to update auto-reply: ' + (error.message || 'Unknown error'));
      setAutoReplySettings(prev => ({ ...prev, isLoading: false }));
    }
  };

  const fetchPages = async (accessToken) => {
    if (!accessToken) {
      setConnectionStatus('No Facebook access token found. Please try reconnecting.');
      setIsConnecting(false);
      setFacebookConnected(false);
      return { mappedPages: [], userInfo: null };
    }
    
    try {
      const permissionsResponse = await new Promise((resolve, reject) => {
        window.FB.api('/me/permissions', { access_token: accessToken }, (response) => {
          if (response.error) reject(new Error(response.error.message));
          else resolve(response);
        });
      });
      
      const grantedPermissions = permissionsResponse.data?.filter(p => p.status === 'granted').map(p => p.permission) || [];
      const requiredPermissions = ['pages_show_list', 'pages_manage_posts'];
      const missingPermissions = requiredPermissions.filter(p => !grantedPermissions.includes(p));
      
      if (missingPermissions.length > 0) {
        setConnectionStatus(`Missing permissions: ${missingPermissions.join(', ')}. Your app needs "Pages API" permissions.`);
      }
      
      const userInfo = await new Promise((resolve, reject) => {
        window.FB.api('/me', { access_token: accessToken, fields: 'id,name,email' }, (response) => {
          if (response.error) reject(new Error(response.error.message));
          else resolve(response);
        });
      });
      
      const pagesResponse = await new Promise((resolve, reject) => {
        window.FB.api('/me/accounts', {
          access_token: accessToken,
          fields: 'id,name,category,access_token,picture,fan_count,tasks'
        }, (response) => {
          if (response.error) {
            reject(new Error(`${response.error.message} (Code: ${response.error.code})`));
          } else {
            resolve(response);
          }
        });
      });

      const pages = pagesResponse.data || [];
      const mappedPages = pages.map(page => {
        const tasks = page.tasks || [];
        const canPost = tasks.includes('CREATE_CONTENT') || tasks.includes('MANAGE');
        const canComment = tasks.includes('MODERATE') || tasks.includes('MANAGE');
        
        return {
          id: page.id,
          internalId: null,
          name: page.name,
          category: page.category || 'Page',
          access_token: page.access_token,
          profilePicture: page.picture?.data?.url || '',
          canPost: canPost,
          canComment: canComment,
          followerCount: page.fan_count || 0
        };
      });

      setAvailablePages(mappedPages);
      
      if (mappedPages.length === 1) {
        setSelectedPage(mappedPages[0]);
        setConnectionStatus(`Connected successfully! 1 page found.`);
        // Load auto-reply settings for the single page
        setTimeout(() => loadAutoReplySettings(), 500);
      } else if (mappedPages.length > 1) {
        setSelectedPage(null);
        setConnectionStatus(`Connected successfully! ${mappedPages.length} pages found. Please select a page below.`);
      } else {
        setSelectedPage({
          id: userInfo.id,
          internalId: null,
          name: userInfo.name,
          access_token: accessToken,
          category: 'Personal Profile',
          profilePicture: '',
          canPost: true,
          canComment: true,
          followerCount: 0
        });
        setConnectionStatus('Connected as personal profile (no pages found).');
        // Load auto-reply settings for personal profile
        setTimeout(() => loadAutoReplySettings(), 500);
      }
      setFacebookConnected(true);
      setCardFlipped(true);
      setIsConnecting(false);
      return { mappedPages, userInfo };
    } catch (error) {
      console.error('Facebook API error:', error);
      setConnectionStatus('Failed to get Facebook data: ' + (error.message || 'Unknown error'));
      setIsConnecting(false);
      setFacebookConnected(false);
      return { mappedPages: [], userInfo: null };
    }
  };

  const connectToBackend = async (accessToken, userInfo, pages) => {
    try {
      const response = await apiClient.connectFacebook(accessToken, userInfo.id, pages);
      
      if (response.data?.data?.token_type === 'long_lived_user_token') {
        const expiresAt = response.data.data.token_expires_at;
        if (expiresAt) {
          const expiryDate = new Date(expiresAt);
          setConnectionStatus(`Connected with long-lived token (expires: ${expiryDate.toLocaleDateString()})`);
        } else {
          setConnectionStatus('Connected with long-lived token');
        }
      }
      
      setTimeout(async () => {
        try {
          const socialAccounts = await apiClient.getSocialAccounts();
          const facebookAccounts = socialAccounts.filter(acc => 
            acc.platform === 'facebook' && acc.is_connected
          );
          
          const updatedPages = availablePages.map(page => {
            const matchingAccount = facebookAccounts.find(acc => 
              acc.platform_user_id === page.id
            );
            return {
              ...page,
              internalId: matchingAccount?.id
            };
          });
          
          setAvailablePages(updatedPages);
          
          if (selectedPage) {
            const matchingAccount = facebookAccounts.find(acc => 
              acc.platform_user_id === selectedPage.id
            );
            if (matchingAccount) {
              setSelectedPage(prev => ({
                ...prev,
                internalId: matchingAccount.id
              }));
            }
          }
        } catch (error) {
          console.error('Error updating page data with internal IDs:', error);
          setConnectionStatus('Warning: Unable to get account details. You may need to reconnect Facebook for scheduling to work.');
        }
      }, 2000);
      
      return response;
    } catch (error) {
      console.error('Backend connection error:', error);
      
      if (error.response?.status === 401) {
        setConnectionStatus('Your session has expired. Please log out and log back in to connect Facebook.');
        setTimeout(() => {
          logout();
          navigate('/');
        }, 3000);
      } else if (error.response?.data?.detail?.includes('long-lived token')) {
        setConnectionStatus('Failed to get long-lived Facebook token. Please try reconnecting.');
      } else {
        setConnectionStatus('Failed to connect to backend: ' + (error.response?.data?.detail || error.message));
      }
      
      throw error;
    }
  };

  const handleAutoInputChange = (e) => {
    const { name, value, files } = e.target;
    setAutoFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleManualInputChange = (e) => {
    const { name, value, files } = e.target;
    setManualFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleMediaTypeChange = (type, formType) => {
    // If it's a file upload type, open the file picker
    if (type === 'photo' || type === 'video') {
      openFilePicker(type, formType);
      return;
    }
    
    // For other types (none, ai_image), set directly
    if (formType === 'auto') {
      setAutoFormData(prev => ({
        ...prev,
        mediaType: type,
        mediaFile: null,
        generatedImageUrl: type === 'ai_image' ? prev.generatedImageUrl : null,
        generatedImageFilename: type === 'ai_image' ? prev.generatedImageFilename : null,
        imagePrompt: type === 'ai_image' ? prev.imagePrompt : ''
      }));
    } else {
      setManualFormData(prev => ({
        ...prev,
        mediaType: type,
        mediaFile: null,
        generatedImageUrl: type === 'ai_image' ? prev.generatedImageUrl : null,
        generatedImageFilename: type === 'ai_image' ? prev.generatedImageFilename : null,
        imagePrompt: type === 'ai_image' ? prev.imagePrompt : ''
      }));
    }
  };

  // File picker functions
  const openFilePicker = (type, formType) => {
    setFilePickerType(type);
    setFilePickerFormType(formType);
    setShowFilePicker(true);
  };

  const closeFilePicker = () => {
    setShowFilePicker(false);
    setFilePickerType('');
    setFilePickerFormType('');
    setIsLoadingGoogleDrive(false);
  };

  const handleLocalFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const setFormData = filePickerFormType === 'auto' ? setAutoFormData : setManualFormData;
      setFormData(prev => ({
        ...prev,
        mediaFile: file,
        mediaType: filePickerType // Set the media type based on what was selected
      }));
      closeFilePicker();
    }
  };

  const handleGoogleDriveSelect = async () => {
    setIsLoadingGoogleDrive(true);
    try {
      // 1️⃣ Check if already authenticated
      const status = await apiClient.getGoogleDriveStatus();
      if (!status.authenticated) {
        // 2️⃣ Get consent URL for popup
        const authResponse = await apiClient.getGoogleDriveAuthorizeUrl();
        if (authResponse.consent_url) {
          // 3️⃣ Open popup and wait for completion
          await openDriveAuthPopup(authResponse.consent_url);
        }
      }

      // 4️⃣ After popup closes, re-check authentication status
      const finalStatus = await apiClient.getGoogleDriveStatus();
      if (!finalStatus.authenticated) {
        throw new Error('Authentication was not completed successfully');
      }

      // 5️⃣ Update state and proceed with Google Drive picker
      setGoogleDriveAvailable(true);

      // Initialize Google Drive API
      await loadGoogleDriveAPI();
      
      // Check if google object is available
      if (typeof window.google === 'undefined' || !window.google.picker) {
        throw new Error('Google Picker API failed to load');
      }
      
      // Get fresh token for picker
      const authResult = await apiClient.getGoogleDriveToken();
      
      // Open Google Drive picker
      const picker = new window.google.picker.PickerBuilder()
        .addView(new window.google.picker.DocsView()
          .setIncludeFolders(true)
          .setSelectFolderEnabled(false)
          .setMimeTypes(filePickerType === 'photo' ? 'image/*' : 'video/*'))
        .setOAuthToken(authResult.access_token)
        .setDeveloperKey(process.env.REACT_APP_GOOGLE_DEVELOPER_KEY || '')
        .setCallback(handleGoogleDriveCallback)
        .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED, false)
        .setTitle('Select a file from Google Drive')
        .setSelectableMimeTypes(filePickerType === 'photo' ? 'image/*' : 'video/*')
        .build();
      
      picker.setVisible(true);
      
    } catch (error) {
      console.error('Error with Google Drive selection:', error);
      setConnectionStatus(`Google Drive error: ${error.message}`);
    } finally {
      setIsLoadingGoogleDrive(false);
    }
  };

  const loadGoogleDriveAPI = () => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.picker) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        if (window.gapi) {
          window.gapi.load('picker', () => {
            resolve();
          });
        } else {
          reject(new Error('Google API failed to load'));
        }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const getGoogleDriveToken = async () => {
    // This would typically come from your backend after user authentication
    // For now, we'll use a placeholder - you'll need to implement OAuth flow
    try {
      const response = await apiClient.getGoogleDriveToken();
      return response.access_token;
    } catch (error) {
      throw new Error('Google Drive authentication required. Please connect your Google account first.');
    }
  };

  const handleGoogleDriveCallback = async (data) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const file = data.docs[0];
      try {
        // Download the file from Google Drive
        const fileContent = await downloadGoogleDriveFile(file.id);
        
        // Create a File object from the downloaded content
        const blob = new Blob([fileContent], { 
          type: file.mimeType 
        });
        const fileObj = new File([blob], file.name, { 
          type: file.mimeType 
        });
        
        // Update the form data
        const setFormData = filePickerFormType === 'auto' ? setAutoFormData : setManualFormData;
        setFormData(prev => ({
          ...prev,
          mediaFile: fileObj,
          mediaType: filePickerType // Set the media type based on what was selected
        }));
        
        closeFilePicker();
        setConnectionStatus('File selected from Google Drive successfully!');
      } catch (error) {
        console.error('Error downloading file from Google Drive:', error);
        setConnectionStatus('Failed to download file from Google Drive: ' + error.message);
      }
    }
  };

  const downloadGoogleDriveFile = async (fileId) => {
    // This would typically be handled by your backend
    // For now, we'll use a placeholder implementation
    try {
      const response = await apiClient.downloadGoogleDriveFile(fileId);
      return response.fileContent;
    } catch (error) {
      throw new Error('Failed to download file from Google Drive');
    }
  };

  const generatePostContent = async () => {
    if (!autoFormData.prompt.trim()) {
      setConnectionStatus('Please enter a prompt for AI generation');
      return;
    }

    setAutoFormData(prev => ({ ...prev, isGenerating: true }));
    setConnectionStatus('Generating content with AI...');

    try {
      const response = await apiClient.generateContent(autoFormData.prompt);
      setAutoFormData(prev => ({
        ...prev,
        generatedContent: response.content,
        isGenerating: false
      }));
      setConnectionStatus('Content generated successfully!');
    } catch (error) {
      console.error('Content generation error:', error);
      setConnectionStatus('Failed to generate content: ' + (error.message || 'Unknown error'));
      setAutoFormData(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const generateImage = async (formType) => {
    const currentData = formType === 'auto' ? autoFormData : manualFormData;
    const setFormData = formType === 'auto' ? setAutoFormData : setManualFormData;
    
    const imagePrompt = currentData.imagePrompt || currentData.prompt || (formType === 'manual' ? currentData.message : '');
    
    if (!imagePrompt.trim()) {
      setConnectionStatus('Please enter an image prompt or description');
      return;
    }

    setFormData(prev => ({ ...prev, isGeneratingImage: true }));
    setConnectionStatus('Generating image with AI...');

    try {
      const response = await apiClient.generateFacebookImage(imagePrompt, 'feed');
      
      if (response.success) {
        setFormData(prev => ({
          ...prev,
          generatedImageUrl: response.data.image_url,
          generatedImageFilename: response.data.filename,
          isGeneratingImage: false
        }));
        setConnectionStatus('Image generated successfully!');
      } else {
        throw new Error(response.error || 'Image generation failed');
      }
    } catch (error) {
      console.error('Image generation error:', error);
      setConnectionStatus('Failed to generate image: ' + (error.message || 'Unknown error'));
      setFormData(prev => ({ ...prev, isGeneratingImage: false }));
    }
  };

  const generateImageWithCaption = async () => {
    if (!autoFormData.prompt.trim()) {
      setConnectionStatus('Please enter a prompt for generation');
      return;
    }

    setAutoFormData(prev => ({ ...prev, isGenerating: true, isGeneratingImage: true }));
    setConnectionStatus('Generating image and caption with AI...');

    try {
      const textResponse = await apiClient.generateContent(autoFormData.prompt);
      
      if (!textResponse.content) {
        throw new Error('Failed to generate text content');
      }

      const imagePrompt = autoFormData.imagePrompt || autoFormData.prompt;
      const imageResponse = await apiClient.generateFacebookImage(imagePrompt, 'feed');
      
      if (!imageResponse.success) {
        throw new Error(imageResponse.error || 'Image generation failed');
      }

      setAutoFormData(prev => ({
        ...prev,
        generatedContent: textResponse.content,
        generatedImageUrl: imageResponse.data.image_url,
        generatedImageFilename: imageResponse.data.filename,
        isGenerating: false,
        isGeneratingImage: false
      }));
      
      setConnectionStatus('Image and caption generated successfully!');
    } catch (error) {
      console.error('Image with caption generation error:', error);
      setConnectionStatus('Failed to generate image and caption: ' + (error.message || 'Unknown error'));
      setAutoFormData(prev => ({ ...prev, isGenerating: false, isGeneratingImage: false }));
    }
  };

  const publishPost = async () => {
    if (!selectedPage) {
      setConnectionStatus('Please select a page first');
      return;
    }

    const isAutoMode = activeTab === 'auto';
    const content = isAutoMode ? autoFormData.generatedContent : manualFormData.message;
    const mediaType = isAutoMode ? autoFormData.mediaType : manualFormData.mediaType;
    const mediaFile = isAutoMode ? autoFormData.mediaFile : manualFormData.mediaFile;
    const generatedImageUrl = isAutoMode ? autoFormData.generatedImageUrl : manualFormData.generatedImageUrl;
    const generatedImageFilename = isAutoMode ? autoFormData.generatedImageFilename : manualFormData.generatedImageFilename;

          // Debug: Log key info
      console.log('Publish attempt - Tab:', activeTab, 'Content:', content?.substring(0, 50) + '...');
      console.log('Media type:', mediaType);
      console.log('Media file:', mediaFile);
      console.log('Selected page:', selectedPage);

    // Allow video-only posts (no text required for video posts)
    if (!content || content.trim() === '') {
      if (mediaType !== 'video') {
        setConnectionStatus('Please enter some content for your post');
        return;
      }
    }

    if (mediaType === 'photo' && !mediaFile) {
      setConnectionStatus('Please select a media file to upload');
      return;
    }

    if (mediaType === 'video' && !mediaFile) {
      setConnectionStatus('Please select a video file to upload');
      return;
    }

    if (mediaType === 'ai_image' && (!generatedImageUrl || !generatedImageFilename)) {
      setConnectionStatus('Please generate an image first');
      return;
    }

    try {
      setIsPublishing(true);
      setConnectionStatus('Publishing post to Facebook...');
      
      let postResult;
      
      // Use the unified Facebook post creation endpoint
      const postOptions = {
        postType: 'feed'
      };

      // Handle content based on mode
      if (isAutoMode) {
        // In auto mode, we might want to use AI generation
        if (autoFormData.generatedContent) {
          // Use pre-generated content
          postOptions.textContent = autoFormData.generatedContent;
        } else if (autoFormData.prompt) {
          // Use prompt for AI generation
          postOptions.contentPrompt = autoFormData.prompt;
          postOptions.useAIText = true;
        } else {
          // Fallback to any content we have
          postOptions.textContent = content;
        }
      } else {
        // In manual mode, use the provided text content if available
        if (content && content.trim()) {
          postOptions.textContent = content;
        }
      }

      // Debug: Log what we're sending
      console.log('Post options:', { ...postOptions, textContent: postOptions.textContent?.substring(0, 50) + '...' });

      if (mediaType === 'ai_image' && generatedImageUrl && generatedImageFilename) {
        // Post with pre-generated image
        postOptions.imageUrl = generatedImageUrl;
        postOptions.imageFilename = generatedImageFilename;
      } else if (mediaType === 'ai_image' && (autoFormData.imagePrompt || manualFormData.imagePrompt)) {
        // Generate image using AI
        const imagePrompt = isAutoMode ? autoFormData.imagePrompt : manualFormData.imagePrompt;
        postOptions.imagePrompt = imagePrompt;
        postOptions.useAIImage = true;
      } else if (mediaType === 'photo' && mediaFile) {
        // Post with uploaded image (convert to base64)
        const imageData = await fileToBase64(mediaFile);
        postOptions.imageUrl = imageData;
      } else if (mediaType === 'video' && mediaFile) {
        // Post with uploaded video (convert to base64)
        try {
          console.log('Converting video to base64...');
          const videoData = await fileToBase64(mediaFile);
          console.log('Video converted successfully, length:', videoData.length);
          postOptions.videoUrl = videoData;
          postOptions.videoFilename = mediaFile.name;
        } catch (error) {
          console.error('Error converting video to base64:', error);
          throw new Error('Failed to process video file: ' + error.message);
        }
      }

      // Validate that we have at least one required field
      if (!postOptions.textContent && !postOptions.contentPrompt && !postOptions.imageUrl && !postOptions.imagePrompt && !postOptions.videoUrl) {
        throw new Error('No content provided. Please add text content, generate content, or add media.');
      }

      // Debug: Log final options being sent to API
      console.log('Final post options being sent to API:', postOptions);
      console.log('Selected page ID:', selectedPage.id);
      console.log('Post options keys:', Object.keys(postOptions));
      console.log('Has video URL:', !!postOptions.videoUrl);
      console.log('Has image URL:', !!postOptions.imageUrl);
      console.log('Has text content:', !!postOptions.textContent);

      console.log('Calling API with page ID:', selectedPage.id);
      postResult = await apiClient.createFacebookPost(selectedPage.id, postOptions);
      console.log('API response:', postResult);
      
      if (!postResult.success) {
        throw new Error(postResult.error || 'Failed to create post via backend');
      }

      setConnectionStatus('Post published successfully!');
      
      setTimeout(() => {
        loadPostHistory();
      }, 1000);
      
      if (isAutoMode) {
        setAutoFormData(prev => ({
          ...prev,
          prompt: '',
          generatedContent: '',
          mediaFile: null,
          mediaType: 'none',
          imagePrompt: '',
          generatedImageUrl: null,
          generatedImageFilename: null
        }));
      } else {
        setManualFormData(prev => ({
          ...prev,
          message: '',
          mediaFile: null,
          mediaType: 'none',
          imagePrompt: '',
          generatedImageUrl: null,
          generatedImageFilename: null
        }));
      }

    } catch (error) {
      console.error('Post publishing error:', error);
      setConnectionStatus('Failed to publish post: ' + (error.message || 'Unknown error'));
    } finally {
      setIsPublishing(false);
    }
  };

  const loginWithFacebook = async () => {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setConnectionStatus('Facebook login requires HTTPS. Please use https://localhost:3001 or deploy with HTTPS');
      return;
    }

    try {
      await apiClient.getCurrentUser();
    } catch (error) {
      setConnectionStatus('Your session has expired. Please log out and log back in to connect Facebook.');
      setTimeout(() => {
        logout();
        navigate('/');
      }, 3000);
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('Loading Facebook SDK...');

    try {
      await loadFacebookSDK(FACEBOOK_APP_ID);

      if (!window.FB || typeof window.FB.login !== 'function') {
        setConnectionStatus('Facebook SDK failed to load. Please refresh the page and try again.');
        setIsConnecting(false);
        return;
      }

      setConnectionStatus('Connecting to Facebook...');
      
      window.FB.login((response) => {
        if (response.authResponse && response.authResponse.accessToken) {
          setConnectionStatus('Facebook login successful! Fetching pages...');
          
          (async () => {
            try {
              const { mappedPages, userInfo } = await fetchPages(response.authResponse.accessToken);
              
              if (mappedPages.length > 0) {
                setConnectionStatus('Connecting to backend...');
                const backendResponse = await connectToBackend(response.authResponse.accessToken, userInfo, mappedPages);
                
                if (backendResponse?.data?.pages) {
                  setAvailablePages(mappedPages);
                  setConnectionStatus(`Connected successfully! ${backendResponse.data.pages_connected} pages synchronized with backend.`);
                }
              } else {
                setConnectionStatus('No pages found in Facebook API. Connecting to backend to check for existing connections...');
                
                try {
                  await connectToBackend(response.authResponse.accessToken, userInfo, []);
                  
                  const existingAccounts = await apiClient.getSocialAccounts();
                  const facebookPages = existingAccounts.filter(acc => 
                    acc.platform === 'facebook' && acc.account_type === 'page' && acc.is_connected
                  );
                  
                  if (facebookPages.length > 0) {
                    const backendMappedPages = facebookPages.map(page => ({
                      id: page.platform_user_id,
                      internalId: page.id,
                      name: page.display_name,
                      category: page.platform_data?.category || 'Page',
                      access_token: page.access_token || response.authResponse.accessToken,
                      profilePicture: page.profile_picture_url || '',
                      canPost: page.platform_data?.can_post !== false,
                      canComment: page.platform_data?.can_comment !== false,
                      followerCount: page.follower_count || 0
                    }));
                    
                    setAvailablePages(backendMappedPages);
                    setConnectionStatus(`Found ${facebookPages.length} existing page(s) from previous connections!`);
                  } else {
                    setConnectionStatus('No pages found. You may need to grant page permissions or create a Facebook page first.');
                  }
                } catch (backendError) {
                  console.error('[FB.login] Backend check failed:', backendError);
                  setConnectionStatus('No pages found. You may need to grant page permissions or create a Facebook page first.');
                }
              }
            } catch (error) {
              console.error('[FB.login] Error in page fetching or backend connection:', error);
              setConnectionStatus('Error during setup: ' + (error.message || 'Unknown error'));
              setIsConnecting(false);
              setFacebookConnected(false);
            }
          })();
        } else {
          if (response.status === 'not_authorized') {
            setConnectionStatus('Please authorize the app to continue and select at least one page.');
          } else {
            setConnectionStatus('Facebook login cancelled or failed');
          }
          setIsConnecting(false);
        }
      }, {
        scope: [
          'public_profile',
          'pages_show_list',
          'pages_read_engagement', 
          'pages_manage_posts',
          'pages_manage_engagement',
          'pages_read_user_content',
          'pages_manage_metadata'
        ].join(','),
        enable_profile_selector: true,
        return_scopes: true,
        auth_type: 'rerequest',
        display: 'popup'
      });
    } catch (error) {
      console.error('Facebook login error:', error);
      setConnectionStatus('Facebook login failed: ' + error.message);
    }
  };

  const refreshTokens = async () => {
    try {
      setConnectionStatus('Refreshing Facebook tokens...');
      const response = await apiClient.refreshFacebookTokens();
      
      if (response.data.summary.expired > 0) {
        setConnectionStatus(`Token refresh complete. ${response.data.summary.expired} account(s) need reconnection.`);
        setFacebookConnected(false);
        setTimeout(() => {
          checkExistingFacebookConnections();
        }, 1000);
      } else {
        setConnectionStatus(`All tokens are valid. ${response.data.summary.valid} account(s) verified.`);
        checkExistingFacebookConnections();
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      if (error.response?.status === 401) {
        setConnectionStatus('Your session has expired. Please log out and log back in.');
        setTimeout(() => {
          logout();
          navigate('/');
        }, 3000);
      } else {
        setConnectionStatus('Failed to refresh tokens: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const getStatusCardClass = () => {
    if (connectionStatus.includes('Failed') || connectionStatus.includes('error') || connectionStatus.includes('Error')) {
      return 'status-card error';
    } else if (connectionStatus.includes('successful') || connectionStatus.includes('Connected') || connectionStatus.includes('completed')) {
      return 'status-card success';
    } else {
      return 'status-card info';
    }
  };

  const loadAutoReplySettings = async () => {
    if (!selectedPage) return;
    
    try {
      console.log('🔄 Loading auto-reply settings for page:', selectedPage.id, selectedPage.name);
      
      // Get automation rules for Facebook auto-reply
      const rules = await apiClient.getAutomationRules('facebook', 'auto_reply');
      console.log('📋 Found automation rules:', rules);
      
      // Get social accounts to match with the selected page
      const socialAccounts = await apiClient.getSocialAccounts();
      const facebookAccounts = socialAccounts.filter(acc => 
        acc.platform === 'facebook' && acc.is_connected
      );
      console.log('👥 Facebook accounts:', facebookAccounts);
      
      // Find the social account that matches the selected page
      const matchingAccount = facebookAccounts.find(acc => 
        acc.platform_user_id === selectedPage.id
      );
      console.log('🎯 Matching account:', matchingAccount);
      
      if (matchingAccount) {
        // Find the auto-reply rule for this specific social account
        const autoReplyRule = rules.find(rule => 
          rule.social_account_id === matchingAccount.id
        );
        console.log('🤖 Auto-reply rule found:', autoReplyRule);
        
        if (autoReplyRule) {
          setAutoReplySettings(prev => ({
            ...prev,
            enabled: autoReplyRule.is_active,
            template: autoReplyRule.actions?.response_template || prev.template,
            ruleId: autoReplyRule.id,
            selectedPostIds: autoReplyRule.actions?.selected_post_ids || []
          }));
          console.log('✅ Auto-reply settings loaded:', {
            enabled: autoReplyRule.is_active,
            template: autoReplyRule.actions?.response_template,
            ruleId: autoReplyRule.id,
            selectedPostIds: autoReplyRule.actions?.selected_post_ids
          });
        } else {
          // Reset to default state if no rule found
          setAutoReplySettings(prev => ({
            ...prev,
            enabled: false,
            template: 'Thank you for your comment! We appreciate your engagement. 😊',
            ruleId: null,
            selectedPostIds: []
          }));
          console.log('❌ No auto-reply rule found, using defaults');
        }
      } else {
        // No matching account found, reset to default
        setAutoReplySettings(prev => ({
          ...prev,
          enabled: false,
          template: 'Thank you for your comment! We appreciate your engagement. 😊',
          ruleId: null,
          selectedPostIds: []
        }));
        console.log('❌ No matching account found, using defaults');
      }
    } catch (error) {
      console.error('❌ Error loading auto-reply settings:', error);
      // Keep current state on error
    }
  };

  const loadPostsForAutoReply = async () => {
    if (!selectedPage) return;
    
    try {
      setAutoReplySettings(prev => ({ ...prev, isLoadingPosts: true }));
      console.log('🔄 Loading posts for auto-reply selection for page:', selectedPage.id);
      
      const response = await apiClient.getPostsForAutoReply(selectedPage.id);
      console.log('📋 Posts for auto-reply:', response);
      
      if (response.success) {
        setAutoReplySettings(prev => ({
          ...prev,
          availablePosts: response.posts,
          isLoadingPosts: false
        }));
        console.log('✅ Posts loaded for auto-reply selection:', response.posts.length);
        
        // Show user-friendly message if no posts found
        if (response.posts.length === 0) {
          setConnectionStatus('No posts found for auto-reply. Create some posts first using the AI Generate or Manual Post tabs.');
        }
      } else {
        throw new Error(response.error || 'Failed to load posts');
      }
    } catch (error) {
      console.error('❌ Error loading posts for auto-reply:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load posts for auto-reply selection';
      if (error.message.includes('404')) {
        errorMessage = 'Facebook page not found. Please reconnect your Facebook account.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      setConnectionStatus(errorMessage);
      setAutoReplySettings(prev => ({ ...prev, isLoadingPosts: false }));
    }
  };

  const handlePostSelection = (postId) => {
    setAutoReplySettings(prev => {
      const isSelected = prev.selectedPostIds.includes(postId);
      const newSelectedIds = isSelected 
        ? prev.selectedPostIds.filter(id => id !== postId)
        : [...prev.selectedPostIds, postId];
      
      return {
        ...prev,
        selectedPostIds: newSelectedIds
      };
    });
  };

  // Mobile-friendly touch handler for post selection
  const handlePostTouch = (postId, event) => {
    // Prevent double-tap zoom on mobile
    event.preventDefault();
    handlePostSelection(postId);
  };

  const selectAllPosts = () => {
    setAutoReplySettings(prev => ({
      ...prev,
      selectedPostIds: prev.availablePosts.map(post => post.id)
    }));
  };

  const deselectAllPosts = () => {
    setAutoReplySettings(prev => ({
      ...prev,
      selectedPostIds: []
    }));
  };

  const handleSettingsToggle = () => {
    const newShowSettings = !autoReplySettings.showSettings;
    setAutoReplySettings(prev => ({ ...prev, showSettings: newShowSettings }));
    
    // Load posts when opening settings
    if (newShowSettings && autoReplySettings.availablePosts.length === 0) {
      loadPostsForAutoReply();
    }
  };

  return (
    <div className="facebook-page-container">
      {/* Navigation Header */}
      <div className="facebook-header">
        <div className="facebook-header-left">
          <div className={`facebook-icon-container ${facebookConnected ? 'connected' : ''}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877f2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div>
            <h1 className="facebook-title">
              {facebookConnected ? 
                (selectedPage ? `${selectedPage.name}` : 'Facebook Manager') : 
                'Facebook Manager'
              }
            </h1>
            <div className="facebook-subtitle">
              {facebookConnected ? (
                selectedPage ? (
                  <>
                    <div className="status-indicator connected" />
                    <span>
                      {selectedPage.category} • {selectedPage.followerCount || 0} followers
                    </span>
                  </>
                ) : (
                  <>
                    <div className="status-indicator connecting" />
                    <span>Connected • Select a page to continue</span>
                  </>
                )
              ) : (
                <>
                  <div className="status-indicator disconnected" />
                  <span>Not connected • Ready to link your account</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="facebook-header-right">
          {facebookConnected && (
            <button 
              onClick={handleFacebookLogout}
              disabled={isLoggingOut}
              className="btn btn-danger"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              {isLoggingOut ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
          
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
            Dashboard
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <div className={`facebook-main-content ${!facebookConnected ? 'centered' : ''}`}>
        {/* Status Card */}
        {connectionStatus && (
          <div className={getStatusCardClass()}>
            {connectionStatus}
          </div>
        )}

        {/* Main Card */}
        <div className={`facebook-main-card ${!facebookConnected ? 'connect-mode' : ''}`}>
          {!facebookConnected ? (
            /* Connect Card */
            <div className="connect-card">
              <div className="connect-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="#1877f2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              
              <h3 className="connect-title">
                Connect Your Facebook
              </h3>
              
              <button 
                onClick={loginWithFacebook} 
                disabled={isConnecting || isCheckingStatus}
                className="connect-button"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {isCheckingStatus ? 'Checking Connection...' : (isConnecting ? 'Connecting...' : 'Connect Facebook')}
              </button>
            </div>
          ) : (
            /* Connected Content */
            <div className="facebook-connected-content">
              {/* Page Selection */}
              {availablePages.length > 1 && (
                <div className="page-selector">
                  <h3>Select a Page</h3>
                  <div className="pages-grid">
                    {availablePages.map((page) => (
                      <div
                        key={page.id}
                        className={`page-card ${selectedPage?.id === page.id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedPage(page);
                          // Load auto-reply settings for the newly selected page
                          setTimeout(() => loadAutoReplySettings(), 100);
                        }}
                      >
                        <div className="page-avatar">
                          {page.profilePicture ? (
                            <img src={page.profilePicture} alt={page.name} />
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                          )}
                        </div>
                        <div className="page-info">
                          <h4>{page.name}</h4>
                          <p>{page.category} • {page.followerCount || 0} followers</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Content Area */}
              {selectedPage && (
                <div className="facebook-content-area">
                  {/* Auto-Reply Settings */}
                  <div className="auto-reply-section">
                    <div className="auto-reply-header">
                      <div className="auto-reply-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M8 12h.01"/>
                          <path d="M12 12h.01"/>
                          <path d="M16 12h.01"/>
                          <path d="M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                        </svg>
                        <span className="auto-reply-label">AI Auto-Reply</span>
                        <span className={`auto-reply-status ${autoReplySettings.enabled ? 'enabled' : 'disabled'}`}>
                          {autoReplySettings.enabled ? 'ON' : 'OFF'}
                        </span>
                        {autoReplySettings.enabled && autoReplySettings.selectedPostIds.length > 0 && (
                          <span className="auto-reply-count">
                            ({autoReplySettings.selectedPostIds.length} post{autoReplySettings.selectedPostIds.length !== 1 ? 's' : ''})
                          </span>
                        )}
                      </div>
                      <div className="auto-reply-controls">
                        <button
                          onClick={handleSettingsToggle}
                          className="btn btn-secondary btn-small"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                          </svg>
                          Settings
                        </button>
                        <button
                          onClick={handleAutoReplyToggle}
                          disabled={autoReplySettings.isLoading || (!autoReplySettings.enabled && autoReplySettings.selectedPostIds.length === 0)}
                          className={`btn ${autoReplySettings.enabled ? 'btn-danger' : 'btn-success'} btn-small`}
                        >
                          {autoReplySettings.isLoading ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 12a9 9 0 11-6.219-8.56"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 12l2 2 4-4"/>
                            </svg>
                          )}
                          {autoReplySettings.isLoading 
                            ? (isMobile() ? '...' : 'Updating...') 
                            : (autoReplySettings.enabled ? (isMobile() ? 'Off' : 'Disable') : (isMobile() ? 'On' : 'Enable'))
                          }
                        </button>
                      </div>
                    </div>
                    {autoReplySettings.showSettings && (
                      <div className="auto-reply-settings">
                        <div className="auto-reply-posts-section">
                          <div className="auto-reply-posts-header">
                            <h4>Select Posts for Auto-Reply</h4>
                            <div className="auto-reply-posts-controls">
                              <button
                                onClick={selectAllPosts}
                                disabled={autoReplySettings.isLoadingPosts}
                                className="btn btn-secondary btn-small"
                              >
                                Select All
                              </button>
                              <button
                                onClick={deselectAllPosts}
                                disabled={autoReplySettings.isLoadingPosts}
                                className="btn btn-secondary btn-small"
                              >
                                Deselect All
                              </button>
                            </div>
                          </div>
                          
                          {autoReplySettings.isLoadingPosts ? (
                            <div className="loading-posts">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12a9 9 0 11-6.219-8.56"/>
                              </svg>
                              Loading posts...
                            </div>
                          ) : autoReplySettings.availablePosts.length > 0 ? (
                            <div className="auto-reply-posts-list">
                              {autoReplySettings.availablePosts.map((post) => (
                                <div
                                  key={post.id}
                                  className={`auto-reply-post-item ${autoReplySettings.selectedPostIds.includes(post.id) ? 'selected' : ''}`}
                                  onClick={() => handlePostSelection(post.id)}
                                  onTouchStart={(e) => handlePostTouch(post.id, e)}
                                >
                                  <div className="post-checkbox">
                                    <input
                                      type="checkbox"
                                      checked={autoReplySettings.selectedPostIds.includes(post.id)}
                                      onChange={() => handlePostSelection(post.id)}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                  <div className="post-content">
                                    <p className="post-text">{post.content}</p>
                                    <div className="post-meta">
                                      <span className="post-date">
                                        {new Date(post.created_at).toLocaleDateString()}
                                      </span>
                                      {post.has_media && (
                                        <span className="post-media">
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                            <circle cx="8.5" cy="8.5" r="1.5"/>
                                            <polyline points="21,15 16,10 5,21"/>
                                          </svg>
                                          {post.media_count} media
                                        </span>
                                      )}
                                      <span className={`post-status ${post.status}`}>
                                        {post.status}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="no-posts-message">
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              </svg>
                              <p>No posts found. Create some posts first to enable auto-reply.</p>
                            </div>
                          )}
                        </div>
                        
                        <div className="form-group">
                          <label>AI Response Template (Optional)</label>
                          <textarea
                            value={autoReplySettings.template}
                            onChange={(e) => setAutoReplySettings(prev => ({ ...prev, template: e.target.value }))}
                            placeholder="e.g., 'Thank you for your comment! We appreciate your engagement.' (Optional - AI will generate contextual replies mentioning the commenter)"
                            className="form-textarea"
                            rows="2"
                          />
                          <small className="form-helper">
                            Leave empty for AI-generated contextual replies, or provide a guide for the AI. The AI will always mention the commenter.
                          </small>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tab Navigation */}
                  <div className="tab-navigation">
                    <button
                      className={`tab-button ${activeTab === 'auto' ? 'active' : ''}`}
                      onClick={() => setActiveTab('auto')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      {isMobile() ? 'AI' : 'AI Generate'}
                    </button>
                    <button
                      className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`}
                      onClick={() => setActiveTab('manual')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      {isMobile() ? 'Manual' : 'Manual Post'}
                    </button>
                    <button
                      className={`tab-button ${activeTab === 'schedule' ? 'active' : ''}`}
                      onClick={() => {
                        console.log('Schedule tab clicked');
                        setActiveTab('schedule');
                      }}
                      style={{ zIndex: 2, position: 'relative' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                      </svg>
                      {isMobile() ? 'Schedule' : 'Schedule'}
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="tab-content">
                    {/* AI Generate Tab */}
                    {activeTab === 'auto' && (
                      <div className="auto-post-form">
                        <h3>AI Content Generation</h3>
                        
                        {/* AI Prompt Input */}
                        <div className="form-group">
                          <label>Content Prompt</label>
                          <textarea
                            name="prompt"
                            value={autoFormData.prompt}
                            onChange={handleAutoInputChange}
                            placeholder="Describe what you want to post about..."
                            className="form-textarea"
                            rows="3"
                          />
                        </div>

                        {/* Generate Content Button */}
                        <div className="form-group">
                          <button
                            onClick={generatePostContent}
                            disabled={!autoFormData.prompt.trim() || autoFormData.isGenerating}
                            className="btn btn-primary"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            {autoFormData.isGenerating ? 'Generating...' : 'Generate Content'}
                          </button>
                        </div>

                        {/* Generated Content Display */}
                        {autoFormData.generatedContent && (
                          <div className="form-group">
                            <label>Generated Content</label>
                            <textarea
                              value={autoFormData.generatedContent}
                              readOnly
                              className="form-textarea generated-content"
                              rows="4"
                            />
                          </div>
                        )}

                        {/* Media Options */}
                        <div className="form-group">
                          <label>Media Options</label>
                          <div className="media-options">
                            <button
                              type="button"
                              className={`media-option ${autoFormData.mediaType === 'none' ? 'active' : ''}`}
                              onClick={() => handleMediaTypeChange('none', 'auto')}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14,2 14,8 20,8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10,9 9,9 8,9"/>
                              </svg>
                              Text Only
                            </button>
                            <button
                              type="button"
                              className={`media-option ${autoFormData.mediaType === 'ai_image' ? 'active' : ''}`}
                              onClick={() => handleMediaTypeChange('ai_image', 'auto')}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                              </svg>
                              AI Image
                            </button>
                          </div>
                        </div>

                        {/* AI Image Generation */}
                        {autoFormData.mediaType === 'ai_image' && (
                          <div className="ai-image-section">
                            <div className="form-group">
                              <label>Image Prompt</label>
                              <input
                                type="text"
                                name="imagePrompt"
                                value={autoFormData.imagePrompt}
                                onChange={handleAutoInputChange}
                                placeholder="Describe the image you want to generate..."
                                className="form-input"
                              />
                            </div>
                            <div className="form-group">
                              <button
                                onClick={() => generateImage('auto')}
                                disabled={!autoFormData.imagePrompt.trim() || autoFormData.isGeneratingImage}
                                className="btn btn-secondary"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                  <circle cx="8.5" cy="8.5" r="1.5"/>
                                  <polyline points="21,15 16,10 5,21"/>
                                </svg>
                                {autoFormData.isGeneratingImage ? 'Generating...' : 'Generate Image'}
                              </button>
                            </div>
                            {autoFormData.generatedImageUrl && (
                              <div className="form-group">
                                <label>Generated Image</label>
                                <div className="image-preview">
                                  <img 
                                    src={autoFormData.generatedImageUrl} 
                                    alt="Generated" 
                                    className="preview-image"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Generate Both Button */}
                        <div className="form-group">
                          <button
                            onClick={generateImageWithCaption}
                            disabled={!autoFormData.prompt.trim() || autoFormData.isGenerating || autoFormData.isGeneratingImage}
                            className="btn btn-success"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            Generate Content + Image
                          </button>
                        </div>

                        {/* Publish Button */}
                        <div className="form-group">
                          <button
                            onClick={publishPost}
                            disabled={!autoFormData.generatedContent || isPublishing}
                            className="btn btn-primary btn-large"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 2L11 13"/>
                              <polygon points="22,2 15,22 11,13 2,9"/>
                            </svg>
                            {isPublishing ? 'Publishing...' : 'Publish Post'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Manual Post Tab */}
                    {activeTab === 'manual' && (
                      <div className="manual-post-form">
                        <h3>Manual Post</h3>
                        
                        {/* Message Input */}
                        <div className="form-group">
                          <label>Post Message</label>
                          <textarea
                            name="message"
                            value={manualFormData.message}
                            onChange={handleManualInputChange}
                            placeholder="What's on your mind?"
                            className="form-textarea"
                            rows="4"
                          />
                        </div>

                        {/* Media Options */}
                        <div className="form-group">
                          <label>Media Options</label>
                          <div className="media-options">
                            <button
                              type="button"
                              className={`media-option ${manualFormData.mediaType === 'none' ? 'active' : ''}`}
                              onClick={() => handleMediaTypeChange('none', 'manual')}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14,2 14,8 20,8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10,9 9,9 8,9"/>
                              </svg>
                              Text Only
                            </button>
                            <button
                              type="button"
                              className={`media-option ${manualFormData.mediaType === 'photo' ? 'active' : ''}`}
                              onClick={() => handleMediaTypeChange('photo', 'manual')}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21,15 16,10 5,21"/>
                              </svg>
                              Upload Photo
                            </button>
                            <button
                              type="button"
                              className={`media-option ${manualFormData.mediaType === 'video' ? 'active' : ''}`}
                              onClick={() => handleMediaTypeChange('video', 'manual')}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="23,7 16,12 23,17 23,7"/>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                              </svg>
                              Upload Video
                            </button>
                          </div>
                        </div>

                        {/* Photo Upload */}
                        {manualFormData.mediaType === 'photo' && (
                          <div className="form-group">
                            <label>Upload Photo</label>
                            <input
                              type="file"
                              name="mediaFile"
                              accept="image/*"
                              onChange={handleManualInputChange}
                              className="form-file-input"
                            />
                            {manualFormData.mediaFile && (
                              <div className="image-preview">
                                <img 
                                  src={URL.createObjectURL(manualFormData.mediaFile)} 
                                  alt="Preview" 
                                  className="preview-image"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Video Upload */}
                        {manualFormData.mediaType === 'video' && (
                          <div className="form-group">
                            <label>Upload Video</label>
                            <input
                              type="file"
                              name="mediaFile"
                              accept="video/*"
                              onChange={handleManualInputChange}
                              className="form-file-input"
                            />
                            {manualFormData.mediaFile && (
                              <div className="video-preview">
                                <video 
                                  src={URL.createObjectURL(manualFormData.mediaFile)} 
                                  controls
                                  className="preview-video"
                                  style={{ maxWidth: '100%', maxHeight: '300px' }}
                                />
                                <div className="video-info">
                                  <p>File: {manualFormData.mediaFile.name}</p>
                                  <p>Size: {(manualFormData.mediaFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Publish Button */}
                        <div className="form-group">
                          <button
                            onClick={publishPost}
                            disabled={!manualFormData.message.trim() || isPublishing}
                            className="btn btn-primary btn-large"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 2L11 13"/>
                              <polygon points="22,2 15,22 11,13 2,9"/>
                            </svg>
                            {isPublishing ? 'Publishing...' : 'Publish Post'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Schedule Tab */}
                    {activeTab === 'schedule' && (
                      <div className="schedule-form">
                        <h3>Schedule Posts</h3>
                        
                        <div className="form-group">
                          <label>Content Prompt</label>
                          <textarea
                            value={scheduleData.prompt}
                            onChange={(e) => setScheduleData(prev => ({ ...prev, prompt: e.target.value }))}
                            placeholder="What should be posted automatically?"
                            className="form-textarea"
                            rows="3"
                          />
                        </div>

                        <div className="form-group">
                          <label>Frequency</label>
                          <select
                            value={scheduleData.frequency}
                            onChange={(e) => setScheduleData(prev => ({ ...prev, frequency: e.target.value }))}
                            className="form-select"
                          >
                            <option value="once">Once</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="custom">Selecting a particular date</option>
                          </select>
                        </div>

                        {scheduleData.frequency === 'custom' ? (
                          <div className="form-group">
                            <label>Custom Date & Time</label>
                            <input
                              type="datetime-local"
                              value={scheduleData.customDate}
                              onChange={(e) => setScheduleData(prev => ({ ...prev, customDate: e.target.value }))}
                              className="form-input"
                            />
                          </div>
                        ) : (
                          <div className="form-group">
                            <label>Schedule Time</label>
                            <input
                              type="time"
                              value={scheduleData.time}
                              onChange={(e) => setScheduleData(prev => ({ ...prev, time: e.target.value }))}
                              className="form-input"
                            />
                          </div>
                        )}

                        <div className="form-group">
                          <button
                            onClick={handleScheduleToggle}
                            disabled={isTogglingSchedule}
                            className={`btn ${scheduleData.isActive ? 'btn-danger' : 'btn-success'} btn-large`}
                          >
                            {isTogglingSchedule ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12a9 9 0 11-6.219-8.56"/>
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12,6 12,12 16,14"/>
                              </svg>
                            )}
                            {isTogglingSchedule 
                              ? (scheduleData.isActive ? 'Deactivating...' : 'Activating...') 
                              : (scheduleData.isActive ? 'Deactivate Schedule' : 'Activate Schedule')
                            }
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Post History */}
                  <div className="post-history">
                    <div className="post-history-header">
                      <h3>
                        {activeTab === 'auto' && `AI Generated Posts (${autoPostHistory.length})`}
                        {activeTab === 'manual' && `Manual Posts (${manualPostHistory.length})`}
                        {activeTab === 'schedule' && `Scheduled Posts (${scheduleTotalCount})`}
                      </h3>
                      <button
                        onClick={activeTab === 'schedule' ? () => loadScheduledPosts(1) : loadPostHistory}
                        disabled={isLoadingPosts}
                        className="btn btn-secondary btn-small"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 4v6h-6"/>
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                        </svg>
                        Refresh
                      </button>
                    </div>
                    
                    {isLoadingPosts ? (
                      <div className="loading-posts">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 11-6.219-8.56"/>
                        </svg>
                        Loading posts...
                      </div>
                    ) : getCurrentPostHistory().length > 0 ? (
                      <>
                        <div className="posts-list">
                          {getCurrentPostHistory().map((post, index) => (
                            <div key={index} className="post-item">
                              <div className="post-content">
                                {activeTab === 'schedule' ? (
                                  // Special display for scheduled posts
                                  <div className="scheduled-post-content">
                                    <div className="schedule-info">
                                      <span className="schedule-frequency">
                                        {post.frequency} • {post.post_time}
                                      </span>
                                      <span className={`schedule-status ${post.is_active ? 'active' : 'inactive'}`}>
                                        {post.is_active ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                    <p className="schedule-prompt">{post.prompt}</p>
                                    {post.next_execution && (
                                      <div className="next-execution">
                                        Next: {new Date(post.next_execution).toLocaleString()}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  // Regular post display
                                  <>
                                    <p>{post.content}</p>
                                    {post.media_urls && post.media_urls.length > 0 && (
                                      <div className="post-media">
                                        <img src={post.media_urls[0]} alt="Post media" className="post-image" />
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="post-meta">
                                <span className="post-date">
                                  {new Date(post.created_at || post.next_execution).toLocaleDateString()}
                                </span>
                                {activeTab !== 'schedule' && (
                                  <span className={`post-status ${post.status}`}>
                                    {post.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Pagination for scheduled posts */}
                        {activeTab === 'schedule' && scheduleTotalPages > 1 && (
                          <div className="pagination">
                            <button
                              onClick={() => loadScheduledPosts(schedulePage - 1)}
                              disabled={schedulePage <= 1}
                              className="btn btn-secondary btn-small"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="15,18 9,12 15,6"/>
                              </svg>
                              Previous
                            </button>
                            
                            <span className="pagination-info">
                              Page {schedulePage} of {scheduleTotalPages}
                            </span>
                            
                            <button
                              onClick={() => loadScheduledPosts(schedulePage + 1)}
                              disabled={schedulePage >= scheduleTotalPages}
                              className="btn btn-secondary btn-small"
                            >
                              Next
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9,18 15,12 9,6"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="no-posts">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                          {activeTab === 'schedule' ? (
                            <circle cx="12" cy="12" r="10"/>
                          ) : (
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          )}
                        </svg>
                        <p>
                          {activeTab === 'schedule' 
                            ? 'No scheduled posts yet. Create your first schedule!' 
                            : 'No posts yet. Create your first post!'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* File Picker Modal */}
      {showFilePicker && (
        <div className="modal-overlay" onClick={closeFilePicker}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select {filePickerType === 'photo' ? 'Photo' : 'Video'}</h3>
              <button onClick={closeFilePicker} className="modal-close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="file-picker-options">
                <div 
                  className="file-option" 
                  onClick={() => document.getElementById('local-file-input').click()}
                  onTouchStart={(e) => e.preventDefault()}
                >
                  <div className="file-option-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10,9 9,9 8,9"/>
                    </svg>
                  </div>
                  <div className="file-option-content">
                    <h4>Local System</h4>
                    <p>Select a file from your computer</p>
                  </div>
                </div>
                
                <div 
                  className={`file-option ${!googleDriveAvailable ? 'disabled' : ''}`} 
                  onClick={handleGoogleDriveSelect}
                  onTouchStart={(e) => {
                    if (!googleDriveAvailable) {
                      e.preventDefault();
                      return;
                    }
                    e.preventDefault();
                    handleGoogleDriveSelect();
                  }}
                >
                  <div className="file-option-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9,22 9,12 15,12 15,22"/>
                    </svg>
                  </div>
                  <div className="file-option-content">
                    <h4>Google Drive</h4>
                    <p>
                      {googleDriveAvailable 
                        ? 'Select a file from your Google Drive' 
                        : 'Google Drive not configured. See setup guide.'
                      }
                    </p>
                    {isLoadingGoogleDrive && (
                      <div className="loading-indicator">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 11-6.219-8.56"/>
                        </svg>
                        Loading...
                      </div>
                    )}
                    {!googleDriveAvailable && (
                      <div className="unavailable-indicator">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15"/>
                          <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        Not Available
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Hidden file input for local file selection */}
              <input
                id="local-file-input"
                type="file"
                accept={filePickerType === 'photo' ? 'image/*' : 'video/*'}
                onChange={handleLocalFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FacebookPage;