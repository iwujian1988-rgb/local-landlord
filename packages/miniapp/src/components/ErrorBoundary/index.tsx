import React, { Component } from 'react'
import Taro from '@tarojs/taro'
import ErrorState from '../ErrorState'

export default class ErrorBoundary extends Component<{children:React.ReactNode},{hasError:boolean}> {
  state = { hasError: false }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
    this.setState({ hasError: true })
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  handleGoHome = () => {
    Taro.reLaunch({ url: '/pages/home/index' })
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="出了点问题"
          description="页面暂时打不开，请试试重试或返回首页"
          retryText="重新加载"
          actionText="返回首页"
          onRetry={this.handleRetry}
          onAction={this.handleGoHome}
          fullPage
        />
      )
    }
    return this.props.children as React.ReactElement
  }
}
