'use client';

import { useState, useEffect, useRef } from 'react';
import { FiLogOut, FiUser, FiChevronDown } from 'react-icons/fi';
import { supabaseBrowser } from '@/app/lib/supabase';
import { createLogger } from '@/app/lib/supabase/logger';
import type { Session } from '@supabase/supabase-js';

// Initialize logger for this component
const logger = createLogger('user-profile');

export default function UserProfile() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [user, setUser] = useState<{
    email: string | null;
    avatarUrl: string | null;
  }>({
    email: null,
    avatarUrl: null,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get current session
    const fetchUserData = async () => {
      // Add null checking for Supabase client
      if (!supabaseBrowser) {
        logger.error('Supabase client not initialized');
        return;
      }

      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (session?.user) {
        // Add debugging for user metadata and avatar URL
        logger.debug('User metadata:', { metadata: session.user.user_metadata });
        logger.debug('Avatar URL:', { avatarUrl: session.user.user_metadata?.avatar_url });
        logger.debug('Email:', { email: session.user.email });

        // Check if the avatar URL exists and fix potential CORS issues
        let fixedAvatarUrl = session.user?.user_metadata?.avatar_url || null;

        // Google image URLs sometimes have CORS issues, try to fix them if needed
        if (fixedAvatarUrl?.includes('googleusercontent.com')) {
          // Make sure the URL has the correct parameter to avoid CORS issues
          if (!fixedAvatarUrl.includes('=s96-c')) {
            // This is a common size parameter for Google profile images
            fixedAvatarUrl = `${fixedAvatarUrl.split('=')[0]}=s96-c`;
            logger.debug('Fixed Google avatar URL:', { url: fixedAvatarUrl });
          }
        }

        setUser({
          email: session.user.email || null,
          avatarUrl: fixedAvatarUrl,
        });
      }
    };

    fetchUserData();

    // Listen for auth changes
    if (!supabaseBrowser) {
      logger.error('Cannot set up auth listener - Supabase client not initialized');
      return;
    }
    
    const { data: authListener } = supabaseBrowser.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (session?.user) {
        // Also log during auth state changes
        logger.debug('Auth change - User metadata:', { metadata: session.user.user_metadata });
        logger.debug('Auth change - Avatar URL:', { avatarUrl: session.user.user_metadata?.avatar_url });
        logger.debug('Auth change - Email:', { email: session.user.email });

        // Apply the same fix for Google avatar URLs during auth state changes
        let fixedAvatarUrl = session.user?.user_metadata?.avatar_url || null;

        if (fixedAvatarUrl?.includes('googleusercontent.com')) {
          if (!fixedAvatarUrl.includes('=s96-c')) {
            fixedAvatarUrl = `${fixedAvatarUrl.split('=')[0]}=s96-c`;
            logger.debug('Auth change - Fixed Google avatar URL:', { url: fixedAvatarUrl });
          }
        }

        setUser({
          email: session.user.email || null,
          avatarUrl: fixedAvatarUrl,
        });
      } else {
        setUser({
          email: null,
          avatarUrl: null,
        });
      }
    });

    // Handle clicks outside dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      if (!supabaseBrowser) {
        logger.error('Cannot logout - Supabase client not initialized');
        return;
      }
      
      await supabaseBrowser.auth.signOut();
      // Redirect to login page
      window.location.href = '/login';
      logger.info('User logged out successfully');
    } catch (error) {
      logger.error('Error during logout:', error);
    }
  };

  // If user is not logged in, don't show anything
  if (!user.email) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        type="button"
        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="User profile"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt="User profile"
            className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
            onError={(e) => {
              logger.error('Avatar image failed to load', { 
                avatarUrl: user.avatarUrl, 
                email: user.email 
              });
              // Replace with the fallback icon
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              const fallbackDiv = document.createElement('div');
              fallbackDiv.className = "w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-900";
              fallbackDiv.innerHTML = '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500 dark:text-blue-300" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
              parent?.appendChild(fallbackDiv);
            }}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-900">
            <FiUser className="text-blue-500 dark:text-blue-300" />
          </div>
        )}
        <FiChevronDown className={`transition-transform duration-300 ${isDropdownOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700 animate-fadeIn">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="User profile"
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                  onError={(e) => {
                    logger.error('Dropdown avatar image failed to load', { 
                      avatarUrl: user.avatarUrl, 
                      email: user.email 
                    });
                    // Replace with the fallback icon
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    const fallbackDiv = document.createElement('div');
                    fallbackDiv.className = "w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-900";
                    fallbackDiv.innerHTML = '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500 dark:text-blue-300" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
                    parent?.appendChild(fallbackDiv);
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-900">
                  <FiUser className="text-blue-500 dark:text-blue-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{user.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Logged in with Google</p>
              </div>
            </div>
          </div>

          <div className="px-2 py-1">
            <button
              onClick={handleLogout}
              type="button"
              className="flex w-full items-center px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            >
              <FiLogOut className="mr-2" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Add keyframe animation
if (typeof document !== 'undefined') {
  if (!document.querySelector('#user-profile-animations')) {
    const style = document.createElement('style');
    style.id = 'user-profile-animations';
    style.innerHTML = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fadeIn {
        animation: fadeIn 0.2s ease-out forwards;
      }
    `;
    document.head.appendChild(style);
  }
}
