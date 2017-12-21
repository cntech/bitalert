import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { DxTextBoxModule, DxDataGridModule, DxButtonModule } from 'devextreme-angular';


import { AppComponent } from './app.component';
import { DxiColumnModule } from 'devextreme-angular/ui/nested/column-dxi';
import { HttpClientModule } from '@angular/common/http';


@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    DxTextBoxModule,
    DxButtonModule,
    DxDataGridModule,
    DxiColumnModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
