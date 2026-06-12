'use client';
import React, { useState, useEffect } from 'react';
import Sidebar, { Page } from './components/Sidebar';
import DashboardPage from './components/DashboardPage';
import AnalyticsPage from './components/AnalyticsPage';
import VisitorsPage from './components/VisitorsPage';
import UsersPage from './components/UsersPage';
import SubscriptionsPage from './components/SubscriptionsPage';
import SubjectsPage from './components/SubjectsPage';
import LessonsPage from './components/LessonsPage';
import QuizzesPage from './components/QuizzesPage';
import PaymentsPage from './components/PaymentsPage';
import ResourcesPage from './components/ResourcesPage';
import TokenUsagePage from './components/TokenUsagePage';
import DiscountsPage from './components/DiscountsPage';
import InterviewChatsPage from './components/InterviewChatsPage';
import ReviewsPage from './components/ReviewsPage';
import EmailPage from './components/EmailPage';
import AIKeysPage from './components/AIKeysPage';
import UniversitiesPage from './components/UniversitiesPage';
import UniversityPortalPage from './components/UniversityPortalPage';
import BlogsPage from './components/BlogsPage';
import JobListingPage from './components/JobListingPage';
import AIUsagePage from './components/AIUsagePage';
import NotificationsPage from './components/NotificationsPage';
import PaygPricingPage from './components/PaygPricingPage';
import CompanyRoundsPage from './components/CompanyRoundsPage';
import LoginPage from './components/LoginPage';
import TopicInterviewsPage from './components/TopicInterviewsPage';
import HackathonPage from './components/HackathonPage';
import { getAccessToken, clearAuth } from './lib/api';

const pages: Record<Page, React.ReactNode> = {
  dashboard: <DashboardPage />,
  analytics: <AnalyticsPage />,
  visitors: <VisitorsPage />,
  users: <UsersPage />,
  notifications: <NotificationsPage />,
  subscriptions: <SubscriptionsPage />,
  'payg-pricing': <PaygPricingPage />,
  subjects: <SubjectsPage />,
  lessons: <LessonsPage />,
  quizzes: <QuizzesPage />,
  payments: <PaymentsPage />,
  resources: <ResourcesPage />,
  'ai-usage': <TokenUsagePage />,
  interviews: <InterviewChatsPage />,
  discounts: <DiscountsPage />,
  reviews: <ReviewsPage />,
  email: <EmailPage />,
  'ai-keys': <AIKeysPage />,
  universities: <UniversitiesPage />,
  'university-portal': <UniversityPortalPage />,
  blogs: <BlogsPage />,
  'job-listings': <JobListingPage />,
  'ai-stats': <AIUsagePage />,
  'company-rounds': <CompanyRoundsPage />,
  'topic-interviews': <TopicInterviewsPage />,
  hackathon: <HackathonPage />,
};

export default function Home() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      try {
        const savedUser = localStorage.getItem('admin_user');
        if (savedUser) {
          const user = JSON.parse(savedUser);
          if (user.role === 'admin') {
            setAdminUser(user);
            setIsAuthenticated(true);
          } else {
            clearAuth();
          }
        }
      } catch {
        clearAuth();
      }
    }
    setChecking(false);
  }, []);

  const handleLogin = (user: any) => {
    setAdminUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearAuth();
    setIsAuthenticated(false);
    setAdminUser(null);
  };

  if (checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--background)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(108,99,255,0.2)',
            borderTopColor: '#6c63ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        activePage={activePage}
        onPageChange={setActivePage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        adminUser={adminUser}
        onLogout={handleLogout}
      />
      <main
        style={{
          flex: 1,
          marginLeft: sidebarCollapsed ? 72 : 260,
          transition: 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',
          minHeight: '100vh',
          position: 'relative',
        }}
      >
        {/* Ambient background glow */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '50%',
            height: '50%',
            background: 'radial-gradient(ellipse at top right, rgba(108,99,255,0.06), transparent 60%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: '30%',
            width: '40%',
            height: '40%',
            background: 'radial-gradient(ellipse at bottom, rgba(0,212,170,0.04), transparent 60%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          {pages[activePage]}
        </div>
      </main>
    </div>
  );
}
